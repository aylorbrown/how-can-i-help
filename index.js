const path = require('path');
const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const PORT = 3000;
const db = require('./models/connection');
const user = require('./models/user')
const events = require('./models/events');
const es6Renderer = require('express-es6-template-engine');
app.engine('html', es6Renderer);
app.set('views', 'templates');
app.set('view engine', 'html');
app.use(express.static(path.join(__dirname, 'public')));


const bodyParser = require('body-parser');
const parseForm = bodyParser.urlencoded({
    extended: true
});


const session = require('express-session'); //session management middleware
const fileStore = require('session-file-store')(session); // modified version of middleware management and helps save session to file of hard drive




// --- SESSION MANAGEMENT
app.use(session({
    store: new fileStore({}),
    secret: '76260r57650fd743046561076' // must move into secure location
}));

app.use((req, res, next) =>  {
    console.log('***********');
    console.log(req.session);
    console.log('***********');

    next();
});



// --- HOME 
app.get('/', (req, res) => {
    let errorMsg = ''
    if (req.query.msg === 'userLogout') {
        errorMsg = 'You have been signed out!'
    }
    res.render('home', {
        locals: {
            errorMsg
        }
    });
});



// --- SIGNUP
app.get('/signup', (req, res) => { 
    let errorMsg = ''
    if (req.query.msg === 'usernameTaken') {
        errorMsg = 'This username is already taken.'
    }
    res.render('signup', {
        locals: {
            errorMsg
        }
    });
});

app.post('/signup', parseForm, async (req, res) => {
    const {firstName, lastName, organization, email, phoneNumber, username, password} = req.body;
    console.log(req.body);
    console.log(req.query.msg);

    try {
        const userID = await user.createUser(firstName, lastName, organization, email, phoneNumber, username, password);
        res.redirect('/login')
       
    } catch (err) {
        res.redirect('/signup?msg=usernameTaken')
    };
});



// --- LOGIN
app.get('/login', (req, res) => {
    let errorMsg = ''
    if (req.query.msg === 'loginInvalid') {
        errorMsg = 'Username or password is invalid.'
    }
    res.render('login', {
        locals: {
            errorMsg
        }
    });

});

app.post('/login', parseForm, async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body);

    try { // try: checks if username has match in db
        const {isUserValid, theUser} = await user.userLogin(username, password);
        console.log(isUserValid);
        


        // if/else checks if password has match in db
        if (isUserValid)  {
            // add info to user session
            console.log("before req.session.user")
            req.session.user= { // the user object is being created 
                username: theUser.user_name,
                id: theUser.user_id,
                name: theUser.first_name

            };
            console.log("hits req session")
            req.session.save(() => {
                console.log('The session is now saved!!!');
                res.redirect('/profile');
            });

        } else {
            res.redirect('/login?msg=loginInvalid') 
        };

    } catch (err) {
        res.redirect('/login?msg=loginInvalid')
        console.log(err)
    };
});



// --- PROFILE
app.get('/profile', (req, res) => {
    res.render('profile', {
        locals: {
            name: req.session.user.name
        }
    })
});


// --- BROWSE EVENTS
// List All Events - PAGE
app.get('/profile/browseEvents', async (req, res) => {
    const allEvents = await events.listEvents();
    console.log('events -----');
    console.log(allEvents)
    res.render('browseEvents', {
        locals: {
            allEvents: allEvents
        }
    })
});



// --- VIEW A SINGLE EVENT & ITS TASKS

app.post('/profile/browseEvents', parseForm, async (req, res) => {
    console.log('viewing a single event');
    // show me a single event by their id
    const {eventID, eventName} = req.body;
    const oneEvent = await events.oneEvent(eventID);
    res.redirect(`/profile/browseEvents/${eventID}/${eventName}`)
});



app.get('/profile/browseEvents/:eventID(\\d+)/:eventName', async (req, res) => {
    const {eventID, eventName} = req.params;
    const tasksForEvent = await events.getTasks(eventID);
    console.log('tasks -----');
    console.log(tasksForEvent)
    res.render('viewEventTasks', {
        locals: {
            tasksForEvent,
            eventName,
            eventID
        }
    })
});



// --- VIEW USERS TASKS (PARTICIPANT)
app.get('/profile/viewMyEvents', async (req, res) => {
    const userID = req.session.user.id;  
    const allCreatorEvents = await events.listCreatorEvents(userID);  
    const allParticipantEvents = await events.listParticipantTasks(userID);
    const formatParticipantEventCards = await events.formatParticipantEventCards(allParticipantEvents, userID)
    console.log('All Participant Events -----');
    console.log(formatParticipantEventCards)
    // res.send('test')
    res.render('viewMyEvents', {
        locals: {
            allCreatorEvents,
            formatParticipantEventCards
        }
    })
});


// --- UPDATE EVENT (CREATOR)


// --- REMOVE AN EVENT (PARTICIPANT) -BUGGGGG
app.post('/profile/viewMyEvents', parseForm, async (req, res) => {
    console.log('parsing form')
    const userID = req.session.user.id; 
    let {taskID} = req.body;
    taskID = parseInt(taskID)
    events.deleteParticipantTask(taskID, userID);
    console.log('Task Deleted -----');
    res.redirect('/profile/viewMyEvents')
})


// --- CREATE AN EVENT
// < STEP 1 >
// Create An Event - PAGE
app.get('/profile/createevent', async (req, res) => {
    res.render('createEvent')
});

// Create An Event - FORM
app.post('/profile/createevent', parseForm, async (req, res) => {
    const userID = req.session.user.id;
    const {eventName, eventLocation, eventDate, eventTime, eventDescription} = req.body;
    try{
        console.log(req.body);
        const eventID = await events.createEvent(eventName, eventLocation, eventDate, eventTime, eventDescription, userID);
        res.redirect(`/profile/createevent/${eventID}/createtask`)

    } catch (err){
        console.log(err);
    }
})

// < STEP 2 > 
// Create Event Task - PAGE
app.get('/profile/createevent/:eventID(\\d+)/createtask', async (req, res) => {
    res.render('createTask');
});

// Create A Task - FORM
app.post('/profile/createevent/:eventID(\\d+)/createtask', parseForm, async (req, res) => {
    const {eventID} = req.params;
    const {taskList} = req.body;

    try{
     console.log(req.body);
     const taskID = await events.createTask(taskList, eventID); 
     res.render(`eventConfirmation`)

    } catch (err){
        console.log(err);
    }
})



// --- SIGN UP FOR TASK
app.post('/profile/browseEvents/:eventID(\\d+)/:eventName', parseForm, async (req, res) => {
    console.log('assigning user to task');
    const userID = req.session.user.id;
    const {taskID} = req.body;

    const assignUserToTask = await events.assignUserToTask(taskID, userID);
    res.redirect(`/profile/browseEvents/${req.params.eventID}/${req.params.eventName}`)
});





//--- LOGOUT 
    // Get rid of the user's session!
    // Then redirect them to the home page.
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        console.log('The session is now destroyed!!!');
        res.redirect('/?msg=userLogout');
    }); 
})



//----About page--Travis//

app.get('/about', (req, res) => {
    res.render('about.html');
})



server.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});