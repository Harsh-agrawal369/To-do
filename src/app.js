const express = require("express");
const app = express();
const path = require("path");
const mysql = require("mysql");
const { error, count } = require("console");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const config = require("../src/config/config");
const { isLogout, isLogin } = require("./middleware/Auth");
const { name } = require("ejs");

//Creating port variable 5000
const PORT= process.env.PORT || 5000;

//Configuring dotenv path
dotenv.config({path: './.env'})

//Craeting json parsing
app.use(express.json());
app.use(express.urlencoded({extended:false}));

//Creating Database Connection
const db= mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: 'root',
    password: '',
    database: 'to-do'
})

db.connect((error) => {
    if(error){
        console.log(error);
    } else{
        console.log("Database Connected..")
    }
})

//Creating session
app.use(cookieParser());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: config.sessionSecret
}))




//Creating static path for public folder
const static_path = path.join(__dirname, "../public");
app.use(express.static(static_path));

//Setting view Engine ejs
app.set('view engine', 'ejs');


//Listening the Port
app.listen(PORT, () => {
    console.log(`server running at port ${PORT}`);
})

//Render login initially
app.get("/", isLogout, (req,res) => {
    res.render("login",{errorMessage:null});
})

//Render Sign-up
app.get("/Sign-up", isLogout, (req,res)=>{
    res.render("Sign-up",{errorMessage: null});
})

//Render login
app.get("/login", isLogout, (req,res) => {
    res.render("login", {errorMessage: null})
})

//Render home
app.get("/home", isLogin, (req,res) => {
    db.query('select * from user where id = ?', [req.session.user_id], (error, result) => {
        if(error){
            console.error(error);
            return res.status(500).send("Internal Server Error");
        }

        db.query('select * from tasks where user_id = ?', [req.session.user_id], (error, results) => {
            let count =0;
            for(i=0; i<results.length; i++){
                if(results[i].completed == 0){
                    count++;
                }
            }
            if(error){
                console.error(error);
                return res.status(500).send("Internal Server Error");
            }

            console.log(results.length);
            res.render("home", {name: result[0].name, count: count, data: results});
        })
    })
})


//Logout function
app.get("/logout", isLogin, (req,res) => {
    try{
      req.session.destroy();
      res.redirect('/');
    }catch(err){
      console.log(err);z
    }
})
  

//Handling post request from Sign-up

app.post("/signup",  (req,res)=>{
    const {name, email, gender, contact, password, confirmPassword} = req.body;

    db.query('Select email from user WHERE email = ?', [email], async (error, result) => {
        if(error){
            console.log(error);
            res.render("Sign-up", {errorMessage: "Something went wrong!"});
        }

        if(result.length >0 ){
            res.render("Sign-up", {errorMessage: "Email already in use"});
        } else if(password != confirmPassword){
            res.render("Sign-up", {errorMessage: "Passwords does not match"});
        }else{
            let hashedpassword = await bcrypt.hash(password, 8);
            db.query('Insert into user set ?', {name: name, email: email, gender: gender, contact: contact, password: hashedpassword}, (error, result) => {
                if(error){
                    console.log(error);
                    res.render("Sign-up", {errorMessage: "Something went wrong"});
                } else{
                    res.render("login", {errorMessage: "User Registered! Log in to continue"})
                }
            })
        }
    })
})

//Handling post request from login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    db.query('Select * from user where email = ?', [email], async (error, results) => {
        if (error) {
            console.log(error);
            return res.render("login", { errorMessage: "Something went wrong" });
        }
        if (results.length == 0) {
            return res.render("login", { errorMessage: "Account does not exist! Sign-up to continue" });
        }

        const hashedPassword = results[0].password;

        try {
            const match = await bcrypt.compare(password, hashedPassword);

            if (match) {
                req.session.user_id = results[0].id;
                return res.redirect("/home");
            } else {
                return res.render("login", { errorMessage: "Wrong Password!" });
            }
        } catch (error) {
            console.error(error);
            return res.render("login", { errorMessage: "Something went wrong" });
        }
    });
});

app.post('/Add-task', (req, res) => {
    const task = req.body.task;
    try{
        db.query('Insert into tasks set ?', {user_id: req.session.user_id, task: task, completed: 0}, (error, resu) => {
            if(error){
                console.log(error);
                res.render("login", {errorMessage: "Something went Wrong!"});
            }else{
                db.query('select * from user where id = ?', [req.session.user_id], (error, result) => {
                    if(error){
                        console.error(error);
                        return res.status(500).send("Internal Server Error");
                    }
            
                    db.query('select * from tasks where user_id = ?', [req.session.user_id], (error, results) => {
                        if(error){
                            console.error(error);
                            return res.status(500).send("Internal Server Error");
                        }
            
                        console.log(results.length);
                        res.render("home", {name: result[0].name, count: results.length, data: results} );
                    })
                })
            }
        })

    } catch(err){
        console.log(err);
        res.render("login", {errorMessage: "Something went Wrong!"});
    }
});

app.get("/delete/:id", (req,res) =>{
    const {id} = req.params;
    
    try{
        db.query('delete from tasks where id = ?', [id], (error,result)=> {
            if(error){
                console.log(err);
                res.render("login", {errorMessage: "Something went Wrong!"})
            }
            else{
                res.redirect("/home")
            }
        })
    }catch(err){
        console.log(err);
        res.render("login", {errorMessage: "Something went Wrong!"})
    }
})

app.get("/comp/:id", (req,res) => {
    const {id} = req.params;
    try{
        db.query('update tasks set completed = 1 where id = ?', [id], (error,result)=>{
            if(error){
                console.log(err);
                res.render("login", {errorMessage: "Something went Wrong!"})
            }
            else{
                res.redirect("/home")
            }
        })
    }catch(err){
        console.log(err);
        res.render("login", {errorMessage: "Something went Wrong!"})
    }
})

app.get("/incomp/:id", (req,res) => {
    const {id} = req.params;
    try{
        db.query('update tasks set completed = 0 where id = ?', [id], (error,result)=>{
            if(error){
                console.log(err);
                res.render("login", {errorMessage: "Something went Wrong!"})
            }
            else{
                res.redirect("/home")
            }
        })
    }catch(err){
        console.log(err);
        res.render("login", {errorMessage: "Something went Wrong!"})
    }
})

