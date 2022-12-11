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

    const access_token = process.env.ACCESS_TOKEN;

    // Checks this is an event from a page subscription
    if (
        body.object === "whatsapp_business_account" &&
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0] &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
    ) {

        let phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
        let from = req.body.entry[0].changes[0].value.messages[0].from;

        if (body.entry[0].changes[0].value.messages[0].type == "text") {
            let msg_body = req.body.entry[0].changes[0].value.messages[0].text.body; // extract the message text from the webhook payload
            axios({
                method: "POST", // Required, HTTP method, a string, e.g. POST, GET
                url:
                    "https://graph.facebook.com/v15.0/" +
                    phone_number_id +
                    "/messages?access_token=" +
                    access_token,
                data: {
                    messaging_product: "whatsapp",
                    to: from,
                    text: { body: "Ack: " + msg_body },
                },
                headers: { "Content-Type": "application/json" },
            });
        }

        // get audio file from whatsapp message and send it back
        if (body.entry[0].changes[0].value.messages[0].type == "audio") {

            let media_id = body.entry[0].changes[0].value.messages[0].audio.id;

            // retrive audio file from whatsapp using media_id
            axios({
                method: "GET",
                url: "https://graph.facebook.com/v15.0/" + media_id + "/",
                auth: {
                    bearer: access_token
                },
                headers: {
                    "Content-Type": "application/json"
                }
            }).then(function (response) {
                let audio = response.data.url;

                axios({
                    method: "POST", // Required, HTTP method, a string, e.g. POST, GET
                    url:
                        "https://graph.facebook.com/v15.0/" +
                        phone_number_id +
                        "/messages?access_token=" +
                        access_token,
                    data: {
                        messaging_product: "whatsapp",
                        to: from,
                        audio: { url: audio },
                    },
                    headers: { "Content-Type": "application/json" },
                });

            }).catch(function (error) {
                console.log(error);
            });
        }

        res.sendStatus(200);

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