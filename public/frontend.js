//Connect to socket server and recieve messages
const socket = new WebSocket('ws://localhost:3000/ws');
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    //Events to update
    if (data.type === 'newPoll') {
        onNewPollAdded(data);  
    } else if (data.type === 'voteUpdate') {
        onIncomingVote(data);  
    }
});


/**
 * Handles adding a new poll to the page when one is received from the server
 * 
 * @param {*} data The data from the server (ideally containing the new poll's ID and it's corresponding questions)
 */
function onNewPollAdded(data) {
    //Add new poll to the HTML
    const pollContainer = document.getElementById('polls');
    const newPoll = document.createElement('li');
    newPoll.classList.add('poll-container');
    newPoll.id = data.pollId; 
    //HTML for added poll
    newPoll.innerHTML = `
        <h2>${data.question}</h2>
        <ul class="poll-options">
            ${data.options.map((option) => `
                <li id="${data.pollId}_${option.answer}">
                    <strong>${option.answer}:</strong> ${option.votes} votes
                </li>
            `).join('')}
        </ul>
        <form class="poll-form button-container">
            ${data.options.map((option) => `
                <button class="action-button vote-button" type="submit" value="${option.answer}" name="poll-option">
                    Vote for ${option.answer}
                </button>
            `).join('')}
            <input type="hidden" value="${data.pollId}" name="poll-id"/>
        </form>
    `;
    pollContainer.appendChild(newPoll);
    newPoll.querySelector('.poll-form').addEventListener('submit', onVoteClicked);
}


/**
 * Handles updating the number of votes an option has when a new vote is recieved from the server
 * 
 * @param {*} data The data from the server (probably containing which poll was updated and the new vote values for that poll)
 */
function onIncomingVote(data) {
    //Collect data from vote and validate
    const { pollId, answer, newVoteCount } = data;
    const pollContainer = document.getElementById(pollId);  
    if (!pollContainer) {
        console.error(`Poll with id ${pollId} not found`);
        return;
    }
    const answerElement = pollContainer.querySelector(`#${pollId}_${answer}`);
    if (!answerElement) {
        console.error(`Answer option with id ${pollId}_${answer} not found`);
        return;
    }
    //Vote count update
    answerElement.innerHTML = `<strong>${answer}:</strong> ${newVoteCount} votes`;
}


/**
 * Handles processing a user's vote when they click on an option to vote
 * 
 * @param {FormDataEvent} event The form event sent after the user clicks a poll option to "submit" the form
 */
function onVoteClicked(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const pollId = formData.get('poll-id');
    const selectedOption = event.submitter.value;
    socket.send(
        JSON.stringify({
          event: "new-vote",
          data: { pollId, selectedOption, userId },
        })
    );
}


//Listens to polls when page loaded
document.querySelectorAll('.poll-form').forEach((pollForm) => {
    pollForm.addEventListener('submit', onVoteClicked);
});
