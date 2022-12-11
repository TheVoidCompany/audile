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

// upload file to assemblyai api using axios
function uploadFile(file) {
    axios({
        method: "POST",
        url: "https://api.assemblyai.com/v2/upload",
        headers: {
            "authorization": process.env.ASSEMBLY_AI_SECRET,
            "content-type": "multipart/form-data",
        },
        data: file,
    }).then(function (response) {
        console.log(response.data);
        return response.data;
    }
    ).catch(function (error) {
        console.log(error);
    }
    );
}

// get TRANSCRIPTION id from assemblyai api using axios
function getTranscriptionId(audioURL) {
    axios({
        method: "POST",
        url: "https://api.assemblyai.com/v2/transcript",
        headers: {
            "authorization": process.env.ASSEMBLY_AI_SECRET,
            "content-type": "application/json",
        },
        data: {
            "audio_url": audioURL,
        },
    }).then(function (response) {
        console.log(response.data);
        return response.data;
    }
    ).catch(function (error) {
        console.log(error);
    }
    );
}

// get TRANSCRIPTION result from assemblyai api using axios
function getTranscription(transcriptionId) {
    axios({
        method: "GET",
        url: "https://api.assemblyai.com/v2/transcript/" + transcriptionId,
        headers: {
            "authorization": process.env.ASSEMBLY_AI_SECRET,
        },
    }).then(function (response) {
        console.log(response.data);
        return response.data;
    }
    ).catch(function (error) {
        console.log(error);
    }
    );
}





app.post("/webhook", async (req, res) => {
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
                method: "POST",
                url:
                    "https://graph.facebook.com/v15.0/" +
                    phone_number_id +
                    "/messages?access_token=" +
                    access_token,
                data: {
                    messaging_product: "whatsapp",
                    to: from,
                    text: { body: "test: " + msg_body },
                },
                headers: { "Content-Type": "application/json" },
            });
        } else if (body.entry[0].changes[0].value.messages[0].type == "audio") {
            // get audio file from whatsapp message and send it back
            let media_id = body.entry[0].changes[0].value.messages[0].audio.id;

            // retrive audio file from whatsapp using media_id
            let audioUrl = await axios.get("https://graph.facebook.com/v15.0/" + media_id + "/", {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + access_token,
                }
            }).then(function (response) {
                return response.data.url;
            });

            // download audio file and upload it to assemblyai api
            // and then get the transcription and send it back to whatsapp

            let audioFile = await axios.get(audioUrl, {
                headers: {
                    "Authorization": "Bearer " + access_token,
                }
            }).then(function (response) {
                return response.data;
            });

            // upload audio file to assemblyai api
            let assemblyURL = await uploadFile(audioFile);

            console.log(assemblyURL);


            // // get transcription id from assemblyai api
            // let transcriptionId = await getTranscriptionId(assemblyURL.upload_url);

            // let transcription = getTranscription(transcriptionId.id);

            // // repeadly call getTranscription every 4 seconds until transcription.status == "completed" or "error"
            // let interval = setInterval(function () {
            //     if (transcription.status == "completed") {
            //         clearInterval(interval);
            //     } else if (transcription.status == "error") {
            //         clearInterval(interval);
            //     } else {
            //         transcription = getTranscription(transcriptionId.id);
            //     }
            // }, 4000);

            // send transcription.text back to whatsapp
            axios({
                method: "POST",
                url:
                    "https://graph.facebook.com/v15.0/" +
                    phone_number_id +
                    "/messages?access_token=" +
                    access_token,
                data: {
                    messaging_product: "whatsapp",
                    to: from,
                    text: { body: JSON.stringify(assemblyURL) },
                },
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    res.status(200).send("EVENT_RECEIVED");
});


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