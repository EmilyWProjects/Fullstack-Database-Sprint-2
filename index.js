const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');

const PORT = 3000;
//TODO: Update this URI to match your own MongoDB setup
const MONGO_URI = 'mongodb://localhost:27017/keyin_test';
const app = express();
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'voting-app-secret',
    resave: false,
    saveUninitialized: false,
}));
let connectedClients = [];

//Note: Not all routes you need are present here, some are missing and you'll need to add them yourself.

app.ws('/ws', (socket, request) => {
    connectedClients.push(socket);

    socket.on('message', async (message) => {
        const data = JSON.parse(message);
        
    });

    socket.on('close', async (message) => {
        
    });
});

//Homepage render
app.get('/', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }
    try {
        // Get the total number of polls in the database
        const pollCount = await Poll.countDocuments();
        
        // Render the index page and pass the poll count
        response.render('index/unauthenticatedIndex', { pollCount });
    } catch (error) {
        console.error('Error fetching poll count:', error);
        response.status(500).json({ errorMessage: 'Error fetching poll count' });
    }
});


//Login render
app.get('/login', async (request, response) => {
  if (request.session.user?.id) return response.redirect("/dashboard"); 
  return response.render("login", { errorMessage: null, session: request.session }); 
});


//Login submission
app.post('/login', async (request, response) => {
    const { username, password } = request.body;
    try {
      //Validate username
      const user = await User.findOne({ username });
      if (!user) {
        return response.render("login", {
            errorMessage: "Invalid username or password",
            session: request.session,
        });
      }
      //Validate password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return response.status(400).json({ errorMessage: 'Invalid username or password!' });
      }
      //Stores session 
      request.session.user = { id: user.id, username: user.username };
      response.redirect("/dashboard");
      
    } catch (error) {
      response.status(500).json({ errorMessage: 'Login error!' });
    }
});


//Logout and destroy session
app.get("/logout", (request, response) => {
    request.session.destroy(() => {
        response.redirect("/");
    });
});


//Signup render
app.get('/signup', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }
    return response.render('signup', { errorMessage: null });
});


//Signup submission
app.post('/signup', async (request, response) => {
    const { username, password } = request.body;
    try {
      //Validate user
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return response.status(400).json({ errorMessage: 'Username unavailable!' });
      }
      //Create user
      const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);
      const user = new User({ username, password: hashedPassword });
      await user.save();
      //Stores session 
      request.session.user = { id: user.id, username: user.username };
      response.redirect("/dashboard");

    } catch (error) {
      response.status(500).json({ errorMessage: 'Registration error!' });
    }
});


//Dashboard render
app.get('/dashboard', async (request, response) => {
    //Only authenticated users
    if (!request.session.user?.id) {
        return response.redirect('/');
    }
    //Get polls
    try {
        const polls = await Poll.find();
        return response.render('index/authenticatedIndex', { polls, user: request.session.user });
    } catch (error) {
        console.error('Error fetching polls:', error);
        response.status(500).json({ errorMessage: 'Error fetching polls.' });
    }
});


//Profile render
app.get('/profile', async (request, response) => {
    //Only authenticated users
    if (!request.session.user?.id) {
        return response.redirect('/'); 
    }
    const userId = request.session.user.id; 
    //Get profile information
    try {
        const user = await User.findById(userId);
        if (!user) {
            return response.status(404).send('User not found');
        }
        //Count polls
        const votedPollsCount = await Poll.countDocuments({ voters: userId });
        response.render('profile', {
            username: user.username, 
            votedPollsCount: votedPollsCount 
        });
    } catch (error) {
        console.error('Error fetching profile data:', error);
        response.status(500).json({ errorMessage: 'Error fetching profile data' });
    }
});

app.get('/createPoll', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }

    return response.render('createPoll')
});

// Poll creation
app.post('/createPoll', async (request, response) => {
    const { question, options } = request.body;
    const formattedOptions = Object.values(options).map((option) => ({ answer: option, votes: 0 }));

    const pollCreationError = onCreateNewPoll(question, formattedOptions);
    //TODO: If an error occurs, what should we do?
});

mongoose.connect(MONGO_URI)
    .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
    .catch((err) => console.error('MongoDB connection error:', err));

/**
 * Handles creating a new poll, based on the data provided to the server
 * 
 * @param {string} question The question the poll is asking
 * @param {[answer: string, votes: number]} pollOptions The various answers the poll allows and how many votes each answer should start with
 * @returns {string?} An error message if an error occurs, or null if no error occurs.
 */
async function onCreateNewPoll(question, pollOptions) {
    try {
        //TODO: Save the new poll to MongoDB
    }
    catch (error) {
        console.error(error);
        return "Error creating the poll, please try again";
    }

    //TODO: Tell all connected sockets that a new poll was added

    return null;
}

/**
 * Handles processing a new vote on a poll
 * 
 * This function isn't necessary and should be removed if it's not used, but it's left as a hint to try and help give
 * an idea of how you might want to handle incoming votes
 * 
 * @param {string} pollId The ID of the poll that was voted on
 * @param {string} selectedOption Which option the user voted for
 */
async function onNewVote(pollId, selectedOption) {
    try {
        
    }
    catch (error) {
        console.error('Error updating poll:', error);
    }
}
