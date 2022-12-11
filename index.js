var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var xhub = require('express-x-hub');
var axios = require("axios").default;

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());


// Adds support for GET requests to our webhook
app.get("/webhook", (req, res) => {

    const verify_token = process.env.VERIFY_TOKEN;

    if (
        req.query['hub.mode'] == 'subscribe' &&
        req.query['hub.verify_token'] == verify_token
    ) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});


app.post("/webhook", (req, res) => {
    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === "whatsapp_business_account") {

        // get audio file from whatsapp message and send it back
        if (body.entry[0].messaging[0].message.attachments[0].type == "audio") {
            let audio = body.entry[0].messaging[0].message.attachments[0].payload.url;
            let sender = body.entry[0].messaging[0].sender.id;
            let messageData = {
                "recipient": {
                    "id": sender
                },
                "message": {
                    "attachment": {
                        "type": "audio",
                        "payload": {
                            "url": audio
                        }
                    }
                }
            };
            callSendAPI(messageData);
        }

        // get video file from whatsapp message and send it back
        if (body.entry[0].messaging[0].message.attachments[0].type == "video") {
            let video = body.entry[0].messaging[0].message.attachments[0].payload.url;
            let sender = body.entry[0].messaging[0].sender.id;
            let messageData = {
                "recipient": {
                    "id": sender
                },
                "message": {
                    "attachment": {
                        "type": "video",
                        "payload": {
                            "url": video
                        }
                    }
                }
            };
            callSendAPI(messageData);
        }


    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
}
);

// Sends response messages via the Send API
function callSendAPI(messageData) {
    axios({
        method: 'post',
        url: 'https://graph.facebook.com/v12.0/me/messages?access_token=' + process.env.ACCESS_TOKEN,
        data: messageData,
        headers: { "Content-Type": "application/json" }
    })
        .then(function (response) {
            console.log(response);
        })
        .catch(function (error) {
            console.log(error);
        });
}




app.listen();