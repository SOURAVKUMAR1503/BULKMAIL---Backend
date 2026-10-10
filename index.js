const dns = require("node:dns");

dns.setServers(["8.8.8.8"]);

const express = require("express")
const cors = require("cors")
const nodemailer = require("nodemailer");
const mongoose = require("mongoose")

const app = express()

app.use(cors())
app.use(express.json())

mongoose.connect("mongodb+srv://souravkumar:1234@cluster0.zpormit.mongodb.net/?appName=Cluster0").then(function () {
    console.log("connected")
}).catch(function () {
    console.log("failed")
})

const credentials = mongoose.model("credentials", {}, "bulkmail")


// Create a transporter using SMTP

app.post("/sendemail", function (req, res) {

    var msg = req.body.msg
    var emailList = req.body.emailList

    credentials.find().then(function (data) {
        const transporter = nodemailer.createTransport({
            service: "gmail",

            // use STARTTLS (upgrade connection to TLS after connecting)
            auth: {
                user: data[0].toJSON().user,
                pass: data[0].toJSON().pass,
            },
        });

        new Promise(async function (resolve, reject) {
            try {
                for (var i = 0; i < emailList.length; i++) {
                    await transporter.sendMail(
                        {
                            from: "souravkumar010503@gmail.com",
                            to: emailList[i],
                            subject: "A message from bulk mail app",
                            text: msg
                        }
                    )
                }
                resolve("success")

            }
            catch (error) {
                reject("failed")
            }

        }).then(function () {
            res.send(true)
        }).catch(function () {
            res.send(false)
        })

    }).catch(function (data) {
        console.log(error)
    })

})

app.listen(5000, function () {
    console.log("server started")
})
