"use strict";

var express = require("express");
var favicon = require("serve-favicon");
var bodyParser = require("body-parser");
var session = require("express-session");
 var csrf = require('csurf');
var consolidate = require("consolidate"); // Templating library adapter for Express
var swig = require("swig");
 var helmet = require("helmet");
var MongoClient = require("mongodb").MongoClient; // Driver for connecting to MongoDB
var http = require("http");
var marked = require("marked");
var helmet = require("helmet");
var nosniff = require('dont-sniff-mimetype');
var app = express(); // Web framework to handle routing requests
var routes = require("./app/routes");
var config = require("./config/config"); // Application config properties
// Fix for A6-Sensitive Data Exposure
// Load keys for establishing secure HTTPS connection
var fs = require("fs");
var https = require("https");
var path = require("path");
// Made the PEM keys.
// var httpsOptions = {
//     key: fs.readFileSync(path.resolve(__dirname, "./artifacts/cert/key.pem")),
//     cert: fs.readFileSync(path.resolve(__dirname, "./artifacts/cert/cert.pem"))
// };
//No damn clue why this is giving me a hard time.
var httpsOptions = {
    key: fs.readFileSync(path.resolve(__dirname, "./artifacts/cert/server.key")),
    cert: fs.readFileSync(path.resolve(__dirname, "./artifacts/cert/server.crt"))
};

MongoClient.connect(config.db, function(err, db) {
    if (err) {
        console.log("Error: DB: connect");
        console.log(err);

        process.exit(1);
    }
    console.log("Connected to the database: " + config.db);

    // Adding/ remove HTTP Headers for security
    app.use(favicon(__dirname + "/app/assets/favicon.ico"));

    // Express middleware to populate "req.body" so we can access POST variables
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        // Mandatory in Express v4
        extended: false
    }));
    // Prevent clickjacking
    app.disable("x-powered-by");
    app.use(helmet.frameguard());
    app.use(helmet.contentSecurityPolicy());
    app.use(helmet.noCache());
    app.use(helmet.hsts());
    app.use(nosniff());
    //app.use(helmet.csp());

    // Enable session management using express middleware
    app.use(session({
        // genid: function(req) {
        //    return genuuid() // use UUIDs for session IDs
        // },
        secret: config.cookieSecret,
        // Both mandatory in Express v4
        saveUninitialized: true,
        resave: true,
        // Fix for A5 - Security MisConfig
        // Use generic cookie name
        key: "sessionId",
        // Fix for A3 - XSS
        // TODO: Add "maxAge"
        cookie: {
            httpOnly: true,
            // Remember to start an HTTPS server to get this working
            // secure: true
            maxAge: 30 * 1000
        }

    }));


    // Fix for A8 - CSRF
    // Enable Express csrf protection
    app.use(csrf());
    // Make csrf token available in templates
    app.use(function(req, res, next) {
        res.locals.csrftoken = req.csrfToken();
        next();
    });


    // Register templating engine
    app.engine(".html", consolidate.swig);
    app.set("view engine", "html");
    app.set("views", __dirname + "/app/views");
    app.use(express.static(__dirname + "/app/assets"));


    // Initializing marked library
    // Fix for A9 - Insecure Dependencies
    marked.setOptions({
        sanitize: true
    });
    app.locals.marked = marked;

    // Application routes
    routes(app, db);

    // Template system setup
    swig.setDefaults({
        autoescape: true
    });

    // // Insecure HTTP connection
    // http.createServer(app).listen(config.port, function() {
    //     console.log("Express http server listening on port " + config.port);
    // });

    // Fix for A6-Sensitive Data Exposure
    // Use secure HTTPS protocol
    https.createServer(httpsOptions, app).listen(config.port,  function() {
        console.log("Express https server listening on port " + config.port);
    });

});
