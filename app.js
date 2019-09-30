const tmi = require("tmi.js");
const mysql = require("mysql2");
const request = require('request');
const rp = require('request-promise-native');
const webapp = require('request');
var keys = require('./keys.js');
var token = "Bearer " + keys.seSecret;

var requestOptions = {
    url: "",
    headers: {
        "Authorization": token,
        "Client-ID": keys.clientid,
        "Content-Type": "application/json"
    }
};


const con = mysql.createConnection({
    host: keys.host,
    user: keys.username,
    password: keys.password,
    database: keys.database,
    port: keys.port
});
const options = {
    options: {
        debug: true

    },
    connection: {
        reconnect: true
    },
    identity: {
        username: keys.botName,
        password: keys.botPassword
    },
    channels: [keys.twitchName],
};



const client = new tmi.client(options);
// Connect the client to the server..
client.connect();
con.connect(function(error) {
    if (error) {
        console.error('Error connecting: ' + error.stack);
        return;
    }
    console.log("Connected as id " + con.threadID);
});



var test = new Boolean(false);
var bets = false;
var userID;
var insertSQL;
var obj;
var displayName;
client.on("chat", function(channel, user, message, self) {
    if (self) return;
    var messageArray = message.split(" ");

    if (messageArray[0] === "!testU") {
        console.log(user);
    }

    if (messageArray[0] === "!test") {
        requestOptions.url = "https://api.streamelements.com/kappa/v2/points/" + keys.channelId + "/westoberfm/1000";
        request.put(requestOptions, function(error, response, body) {
            if (error) throw error;
        });
    }

    if (messageArray[0] === "!killbot") {
        
        client.say(keys.twitchName, "See yeah boys!");
        process.exit();
    }

    if (messageArray[0] === "!points") {
        requestOptions.url = "https://api.streamelements.com/kappa/v2/points/" + keys.channelId + "/" + user.username;
        request.get(requestOptions, function(error, response, body, seData) {
            if (error) throw error;
            seData = JSON.parse(body);
            requestOptions.url = "https://api.twitch.tv/helix/users" + "?login=" + user.username;
            request.get(requestOptions, function(error, response, body, obj, displayName) {
                if (error) throw error;
                obj = JSON.parse(body);
                displayName = obj.data[0].display_name;
                client.say(keys.twitchName, displayName + " has " + seData.points + " Donny points and is rank " + seData.rank + " on the leaderboard.");
            });
        });
    }
    if (messageArray[0] === "!followage") {
        requestOptions.url = "https://api.twitch.tv/helix/users" + "?login=" + user.username;
        request.get(requestOptions, (error, response, data, userID, obj) => {
            if (error) throw error;
            obj = JSON.parse(data);
            userID = obj.data[0].id;
            requestOptions.url = "https://api.twitch.tv/helix/users/follows?from_id=" + userID + "&to_id=" + keys.userID;
            request.get(requestOptions, (error, response, data, obj) => {
                if (error) throw error;
                obj = JSON.parse(data);
                console.log(obj);
                client.say(keys.twitchName, displayName + "has been following musclenoob for");
            });
        });
    }



    if (messageArray[0] === "!tabledata") {
        con.query('SELECT * FROM pointstable', function(error, results) {
            if (error) throw error;
            if (results[0] === undefined)
                console.log("Table is empty");
            else {
                results.forEach(result => {
                    console.log(result);
                });
            }
        });
    }

    if (messageArray[0] === "!tableclear") {
        var clearSQL = "UPDATE pointstable SET betPoints = 0";
        con.query(clearSQL, function(error, result) {
            if (error) throw error;
            console.log("Table cleared");
        });
    }

    if (messageArray[0] === "!tabledelete") {
        var delSQL = "DELETE FROM pointstable";
        con.query(delSQL, function(error, result) {
            if (error) throw error;
            console.log("Table deleted");
        });
    }


    if (messageArray[0] === "!betstate")
        console.log("BETS : " + bets);


    //Turns on betting
    function betting() {
        bets = true;
        client.say(keys.twitchName, "Type '!bet [amount] [win or lose]' to place a bet on this match");
        console.log("POSTBets = : " + bets);
    }

    if (messageArray[0] === "!betting") {
        if (user.mod || user.username === keys.twitchName) {
            betting();
        } else {
            console.log("User is not a mod");
        }
    }


    //Overide Command to turn off betting
    if (messageArray[0] === "!bettingoff" && user.mod) {
        bets = false;
        client.say(keys.twitchName, "Betting has now closed");
    }


    //Command to send a bet on the current fight
    if (messageArray[0] === "!bet") {
        if (bets) {

            //SETUP
            requestOptions.url = "https://api.twitch.tv/helix/users" + "?login=" + user.username;
            request.get(requestOptions, (error, response, data, userID, obj) => {
                if (error) throw error;
                obj = JSON.parse(data);
                userID = obj.data[0].id;

                requestOptions.url = "https://api.streamelements.com/kappa/v2/points/" + keys.channelId + "/" + user.username;
                request.get(requestOptions, (error, response, data, numPoints, obj) => {
                    if (error) throw error;
                    obj = JSON.parse(data);
                    numPoints = obj.points;

                    //Error Catching
                    if (messageArray[1] === undefined) {
                        client.say(keys.twitchName, "Please enter how much you would like to wager");
                        return;
                    } else if (messageArray[2] === undefined) {
                        client.say(keys.twitchName, "Please put either 'win' or 'lose' after your bet amount");
                        return;
                    }
                    if (numPoints < messageArray[1]) {
                        client.say(keys.twitchName, "Bet failed. You do not have enough points");
                        return;
                    } else if (messageArray[1] === 0) {
                        client.say(keys.twitchName, "A bet must be greater than 0");
                        return;
                    }
                    else if(messageArray[1].toLowerCase() === "all"){
                        messageArray[1] = numPoints;
                    }


                    //Conditional and querys
                    if (messageArray[2].toLowerCase() === "win") {
                        var insertSQL = "INSERT INTO pointstable (idColumn,betPoints) VALUES (" + userID + "," + messageArray[1] + ") ON DUPLICATE KEY UPDATE betPoints = " + messageArray[1];
                        con.query(insertSQL, function(error, result) {
                            if (error) throw error;
                            console.log(user.username + " inserted " + messageArray[1] + " into table");
                        });
                        client.say(keys.twitchName, user.username + " bet successful.");
                    } else if (messageArray[2].toLowerCase() === "lose") {
                        messageArray[1] = messageArray[1] * -1;
                        var insertSQL = "INSERT INTO pointstable (idColumn,betPoints) VALUES (" + userID + "," + messageArray[1] + ") ON DUPLICATE KEY UPDATE betPoints = " + messageArray[1];
                        con.query(insertSQL, function(error, result) {
                            if (error) throw error;
                            console.log(user.username + " inserted " + messageArray[1] + " into table");
                        });
                        client.say(keys.twitchName, user.username + " bet successful.");
                    }
                });
            });
        } else {
            client.say(keys.twitchName, "Betting is not open at this time.");
        }
    }

    //Removes the current bet of a specified user
    if (messageArray[0] === "!betremove") {
        if (messageArray[1] === undefined)
            messageArray[1] = user.username;
        cleanString(messageArray);
        if (messageArray[1] !== user.username) {
            if (!user.mod && user.username !== keys.twitchName)
                return;
        }
        cleanString(messageArray);

        requestOptions.url = "https://api.twitch.tv/helix/users" + "?login=" + messageArray[1];
        request.get(requestOptions, (error, response, data, userID, obj) => {
            if (error) throw error;
            obj = JSON.parse(data);
            userID = obj.data[0].id;

            findSQL = "SELECT betPoints FROM pointstable WHERE idColumn = " + userID;
            con.query(findSQL, function(error, result, bPoints) {
                if (result[0] === undefined || result[0].betPoints === 0)
                    client.say(keys.twitchName, messageArray[1] + " does not have a bet to remove");
                else {
                    var removeSQL = "UPDATE pointstable SET betPoints = 0 WHERE idColumn =" + userID;
                    con.query(removeSQL, function(error, result) {
                        if (error) throw error;
                        client.say(keys.twitchName, messageArray[1] + " your bet has been removed");
                        console.log("Removal successful");
                    });
                }
            });
        });
    }




    //Gets the value of a user's bet
    if (messageArray[0] === "!betvalue") {
        if (messageArray[1] === undefined) {
            messageArray[1] = user.username;
        }
        cleanString(messageArray);

        requestOptions.url = "https://api.twitch.tv/helix/users" + "?login=" + messageArray[1];
        request.get(requestOptions, (error, response, data, userID, obj) => {
            if (error) throw error;
            obj = JSON.parse(data);
            if (obj.data[0] === undefined)
                return;
            userID = obj.data[0].id;

            var getSQL = "SELECT betPoints FROM pointstable WHERE idColumn = " + userID;
            con.query(getSQL, function(error, result, bPoints) {
                if (error) throw error;
                if (result[0] != undefined) {
                    bPoints = result[0].betPoints;
                    if (bPoints > 0)
                        client.say(keys.twitchName, messageArray[1] + " has bet " + bPoints + " points for the win!");
                    else if (bPoints < 0)
                        client.say(keys.twitchName, messageArray[1] + " has bet " + (-1) * bPoints + " points for the loss! Have some faith!");
                    else
                        client.say(keys.twitchName, messageArray[1] + " has not submitted a bet");
                } else {
                    client.say(keys.twitchName, messageArray[1] + " has not submitted a bet");
                }
            });
        });
    }

    if (messageArray[0] === "!win") {
        if (user.mod || user.username === keys.twitchName) {
            onWin();
        }
    }


    if (messageArray[0] === "!lose") {
        if (user.mod || user.username === keys.twitchName) {
            onLose();
        }
    }



    //Removes excess characters from the raw text command
    function cleanString(messageArray) {
        if (messageArray[1].startsWith("@")) {
            messageArray[1] = messageArray[1].substring(1, messageArray[1].length);
        }
        messageArray[1] = messageArray[1].toLowerCase();
        messageArray[0] = messageArray[0].toLowerCase();
    }

    async function grabUsername(betPoints, values, idColumn) {
        requestOptions.url = "https://api.twitch.tv/helix/users" + "?id=" + idColumn;
        return rp(requestOptions);
    }

    function winCalc(values) {
        if (values.largestName === undefined && values.smallestName === undefined)
            client.say(keys.twitchName, "Musclenoob won but no one wanted to bet this time :(");
        else if (values.largestName === undefined)
            client.say(keys.twitchName, "Musclenoob won this time but no one believed in him. joej92Scorp The biggest loser was " + values.smallestName + " and they lost " + (-1) * values.smallestLoss + " points.");
        else if (values.smallestName === undefined)
            client.say(keys.twitchName, "Musclenoob won and you all profited! joej92Musclegasm The biggest winner was " + values.largestName + " and they received " + values.largestWin + " points!");
        else
            client.say(keys.twitchName, "Musclenoob won that match! " + values.largestName + " was the biggest winner and added " + values.largestWin + " to their name! joej92Ken But " + values.smallestName + " lost " + (-1) * values.smallestLoss + " points!");
    }

    async function onWin() {
        var winSQL = "SELECT idColumn, betPoints FROM pointstable WHERE betPoints != 0";
        con.query(winSQL, async function(error, result) {

            if (error) throw error;
            var betPoints, largestWin = 0,
                largestName, smallestName, smallestLoss = 0,
                promises = [];
            var values = {
                largestName: undefined,
                smallestName: undefined,
                largestWin: 0,
                smallestLoss: 0
            }
            for (let a of result) {
                var idColumn = a.idColumn;
                betPoints = a.betPoints;
                if (betPoints != 0) {
                    var body = await grabUsername(betPoints, values, idColumn);
                    displayName = JSON.parse(body).data[0].display_name;
                    if (betPoints > values.largestWin) {
                        values.largestWin = betPoints;
                        values.largestName = displayName;
                    }
                    if (betPoints < values.smallestLoss) {
                        values.smallestLoss = betPoints;
                        values.smallestName = displayName;
                    }
                    requestOptions.url = "https://api.streamelements.com/kappa/v2/points/" + keys.channelId + "/" + displayName + "/" + betPoints;
                    request.put(requestOptions, function(error, response, body) {
                        if (error) throw error;
                    });
                }
            }
            winCalc(values);
            betting();

            var pointsSQL = "UPDATE pointstable SET betPoints = 0";
            con.query(pointsSQL, function(error, result) {
                if (error) throw error;
            });

        });
    }


    var loseCalc = (values) => {
        if (values.largestName === undefined && values.smallestName === undefined)
            client.say(keys.twitchName, "Musclenoob lost but no one wanted to bet this time :(");
        else if (values.largestName === undefined)
            client.say(keys.twitchName, "Musclenoob lost and everyone called it! joej92Ken The biggest winner was " + values.smallestName + " and they gained " + (-1) * values.smallestLoss + " points.");
        else if (values.smallestName === undefined)
            client.say(keys.twitchName, "Musclenoob choked hard and you all lost! joej92Imagine The biggest loser was " + values.largestName + " and they had " + values.largestWin + " points stolen from them!");
        else
            client.say(keys.twitchName, "Musclenoob lost the match! " + values.smallestName + " was the biggest winner and added " + (-1) * values.smallestLoss + " to the stash! joej92Ken But " + values.largestName + " lost " + values.largestWin + " points!");
    }

    function onLose() {
        var winSQL = "SELECT idColumn, betPoints FROM pointstable WHERE betPoints != 0";
        con.query(winSQL, async function(error, result) {

            if (error) throw error;
            var betPoints, largestWin = 0,
                largestName, smallestName, smallestLoss = 0,
                promises = [];
            var values = {
                largestName: undefined,
                smallestName: undefined,
                largestWin: 0,
                smallestLoss: 0
            }

            for (let a of result) {
                var idColumn = a.idColumn;
                betPoints = a.betPoints;
                if (betPoints != 0) {
                    var body = await grabUsername(betPoints, values, idColumn);
                    displayName = JSON.parse(body).data[0].display_name;
                    if (betPoints > values.largestWin) {
                        values.largestWin = betPoints;
                        values.largestName = displayName;
                    }
                    if (betPoints < values.smallestLoss) {
                        values.smallestLoss = betPoints;
                        values.smallestName = displayName;
                    }
                    requestOptions.url = "https://api.streamelements.com/kappa/v2/points/" + keys.channelId + "/" + displayName + "/" + (-1) * betPoints;
                    request.put(requestOptions, function(error, response, body) {
                        if (error) throw error;
                    });
                }
            }
            loseCalc(values);
            betting();

            var pointsSQL = "UPDATE pointstable SET betPoints = 0";
            con.query(pointsSQL, function(error, result) {
                if (error) throw error;
            });

        });
    }
});
