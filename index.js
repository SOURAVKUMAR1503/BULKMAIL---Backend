const express = require("express")
const cors = require("cors")
const app = express()

app.use(cors(corsOptions))

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "https://depfront.vercel.app"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  
  app.options('*', (req, res) => { 
    // Pre-flight request. Reply successfully:
    res.header('Access-Control-Allow-Origin', 'https://depfront.vercel.app');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.send();
  });
  
var corsOptions = {
    origin: ["https://depfront.vercel.app/"]
  };

app.use(express.json())

//Install NODEMAILER
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service:"gmail",
  auth: {
    // TODO: replace `user` and `pass` values from <https://forwardemail.net>
    user: "errormakesclever@gmail.com",
    pass: "hmkp btmz dabc tqgq",
  },
});

const emailTemplate = (message, recipient) => ({
    from: "errormakesclever@gmail.com",
    to: recipient,
    subject: 'You get Text Message from Your App!',
    text: message
  });

const sendMails = ({message, emailList}) => {
    return new Promise(async (resolve, reject) => {
        try {
            for (const recipient of emailList) {
                const mailOptions = emailTemplate(message, recipient);
        
                await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${recipient}`);
            }
            resolve("Success")
        } catch (error) {
            console.error('Error sending emails:', error.message);
            reject(error.message)
        }
    })
};

app.post("/sendemail",function(req,res){

    sendMails(req.body).then((response) => {
        console.log(response)
        res.send(true);
    })
    .catch((error) => {
        res.send(false);
    })

})

app.listen(5000,function(){
    console.log("Server Started.....")
})