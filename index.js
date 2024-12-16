//App requirements
const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const PORT = 3000;
const SALT_ROUNDS = 10;
const app = express();


//MongoDB information
const MONGO_URI = 'mongodb://localhost:27017/fullstack-database-sprint';


//Users
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);


//Polls
const pollSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ 
        answer: { type: String }, 
        votes: { type: Number, default: 0 } 
    }],
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Poll = mongoose.model('Poll', pollSchema);


//Environment setup
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
    cookie: { secure: false }
}));
let connectedClients = [];


//Websocket connection
app.ws('/ws', (socket, request) => {
    connectedClients.push(socket);

    socket.on("message", async (message) => {
        const data = JSON.parse(message);
    
        // Handle incoming vote events
        if (data.event === "new-vote") {
            const { pollId, selectedOption, userId } = data.data;
            await onNewVote(pollId, selectedOption, userId); 
        }
    });
    //Close the socket
    socket.on('close', async (message) => {
        connectedClients = connectedClients.filter(client => client !== socket);
    });
});


//Process new votes
async function onNewVote(pollId, selectedOption, userId) {
  try {
    const poll = await Poll.findById(pollId);
    const user = await User.findById(userId);

    if (!poll || !user) return;

    const option = poll.options.find((opt) => opt.answer === selectedOption);
    if (option) {
        option.votes++;
        await poll.save();

        // Track that this user voted on this poll
        poll.voters.push(userId);
        await poll.save();

      // Broadcast updated poll results to all connected clients
        for (const client of connectedClients) {
            client.send(
                JSON.stringify({
                    event: "voteUpdate",
                    data: { pollId: poll._id, options: poll.options },
                })
            );
        }
    }
  } catch (error) {
    console.error("Error updating poll:", error);
  }
}


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


//Create poll render
app.get('/createPoll', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }

    return response.render("createPoll", { session: request.session });
});


//Create poll submission
app.post('/createPoll', async (request, response) => {
    //Only authenticated users
    if (!request.session.user?.id) {
        return response.redirect("/");
    }
    //Create poll
    const { question, options } = request.body;
    const formattedOptions = Object.values(options).map((option) => ({
        answer: option,
        votes: 0,
    }));
    //Validate poll
    const pollCreationError = await onCreateNewPoll(
        question,
        formattedOptions,
        request.session.user.id
    );
    if (pollCreationError) {
        return response.render("createPoll", {
          errorMessage: pollCreationError,
          session: request.session,
        });
    }
    return response.redirect("/dashboard");

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
async function onCreateNewPoll(question, pollOptions, userId) {
    try {
        //Save poll to MongoDB
        const newPoll = new Poll({
            question,
            options: pollOptions,  
            voters: [],            
            createdBy: userId      
        });
        await newPoll.save();
        //Create poll render for all users
        connectedClients.forEach(client => {
            client.send(JSON.stringify({
                type: 'newPoll',
                poll: newPoll
            }));
        });
        return null;
    } catch (error) {
        console.error("Error creating poll:", error);
        return "Error creating the poll, please try again";
    }
}
