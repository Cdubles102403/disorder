const fs = require('fs')
const express = require('express');
const app = express();
const https = require('https');
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};
var server = https.createServer(options, app);
var io = require('socket.io')(server);
const sql = require('sqlite3').verbose();
const chalk = require('chalk')
const crypto = require('crypto')
const functions = require('./serverReusables/function.js')
const PORT = 443; //port to start on


server.listen(PORT,()=>{
console.log(`started on port ${PORT}`)
})

const db = new sql.Database('./db/database.db'); //creates connection to DB


app.use(express.json())
app.use(express.static('views'))
app.use(express.static('public'))

io.on('connection', (socket) => {
    console.log(chalk.black.bgGreen('a user connected'));
    socket.on('disconnect', () => {
      console.log(chalk.black.bgRed('user disconnected'));
    });
    socket.on('sendMessage',(payload)=>{
      //console.log(payload)
      try {
        let decodedToken = functions.verifyJWT(payload.token)
        //console.log(decodedToken) 
        let msgSan = functions.sanitize(payload.message)
        let message = `<p class="message">${msgSan}-<b class="messageTag">${decodedToken.data.username}</b></p>`
        socket.broadcast.emit("msg",message)
        socket.emit("msg",message)
      } catch (error) {
        //console.log(error)
        socket.emit('login')
        return
      }
    })
  });


//login route
app.post('/login',(req,res)=>{
   let body = req.body
   //console.log(body)
   let username = body.username
   let password = body.password
   const checkSQL = 'SELECT * FROM members WHERE username = ?'

  db.all(checkSQL,[username],(err,results)=>{
    if(err) console.error(err)
    if(results.length>=1){
     // console.log(results)
      if(functions.hasher(password)==results[0].password){
        console.log(`succesful login for ${chalk.blueBright(username)}`)
        let token = functions.makeJWT(results[0].password,results[0].email,results[0].username)
        //console.log(functions.verifyJWT(token))
        res.send({message:"successful-login",token:token,target:'/'})
        return
      }
      else{
        res.send({message:'check-username-and-password'})
        return
      }
    }
    else{
      //user not found
      res.send({message:"user-not-found"})
      return
    }
  })
})


function makeRoom(name,maker){
let SQL_makeRoom ='INSERT INTO roomDirectory (name,chatList,memberList) values(?,?,?)'
//create chatList
let chatList = `${name}ChatList`
let SQL_MakeChatList=`CREATE TABLE ${chatList} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, dateCreated INTEGER)`
db.run(SQL_MakeChatList,[],function(err,results){
  if(err){console.error(err)}
  console.log(this.lastID)
})
//create memberList
let memberList=`${name}MemberList`
let SQL_makeMemberList =`CREATE TABLE ${memberList} (if INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,role INTEGER,dateAdded INTEGER )`
db.run(SQL_makeMemberList,[],function(err,results){
  if(err){console.error(err)}
})
//create room, acts as hub
db.run(SQL_makeRoom,[name,chatList,memberList],function (err,results){
  if(err){console.error(err)}
})
}

function saveMessage(sender,room,chat,message){

}

function makeChat(roomName,chatName,maker){

}

//signup route
app.post('/signup',(req,res)=>{
  let body = req.body;
  //console.log(body)
  let email = functions.sanitize(body.email)
  let username = functions.sanitize(body.username)
  let password = body.password
  var passwordR = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/g
  //check password
  if(!password.match(passwordR)){
    //console.log(chalk.bold.redBright("fix-password"))
    res.send({message:"fix-password"})
    return;
  }
  //check if in database
  const checkSQL = 'SELECT * FROM members WHERE username = ?'
  db.all(checkSQL,[username],(err,results)=>{
    console.log(results)
    if(results.length == 0){
      //insert into database
      const insertSQL='INSERT INTO members(username,email,password) VALUES(?,?,?)'
      let hash = functions.hasher(password)
      //console.log(chalk.green(hash))
      db.run(insertSQL,[username,email,hash])
        //redirect
      let token = functions.makeJWT(password,email,username)
      res.send({token:token,message:'redirect', target:"/"})
    }
    else{ //already exists
      res.send({message:"already-exists"})
    }
  })
})

