// Load packages
const express = require("express");
const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const multer = require("multer");
const upload = multer();

require("dotenv").config();

// Database Pool Setup
const { Pool } = require("pg"); 
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
    rejectUnauthorized: false 
    },
    max: 2
});

// Get Requests
app.get('/', (req, res) => {
    //res.send('Hello, World!');
const sql = "SELECT * FROM CUSTOMER ORDER BY custId;";
    pool.query(sql, [], (err, result) => {
        let message = "";
        let model = {};
        if (err) {
            message = `Error- ${err.message}`;
        } else {
            message = "success";
            model = result.rows;
        };
        res.render("index", { 
            message: message, 
            model: model 
        });
    }); 
});

app.get("/manageCustomers", (req, res) => {
    const sql = "SELECT * FROM CUSTOMER ORDER BY custId;";
    pool.query(sql, [], (err, result) => {
        let message = "";
        let model = {}; 
        if (err) {
            message = `Error- ${err.message}`;
        } else {
            message = "success";
            model = result.rows;
        };
        res.render("manageCustomers", { 
            message: message, 
            model: model 
        });
    });
});

app.get("/createCustomer", (req, res) => {
    const sql = "SELECT MAX(custId) AS maxId FROM CUSTOMER;";
    pool.query(sql, [], (err, result) => {
        let message = "";
        let nextId = 1;
        if (err) {
            message = `Error- ${err.message}`;
        } else {
            if (result.rows.length > 0) {
                nextId = result.rows[0].maxid + 1;
            }
        };
        res.render("createCustomer", { 
            message: message, 
            nextId: nextId 
        });
    });
});

app.post("/createCustomer", (req, res) => {
    const custId = req.body.custId;
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const state = req.body.state;
    const salesYTD = req.body.salesYTD;
    const previousYearsSales = req.body.previousYearsSales;
    const sql = "INSERT INTO CUSTOMER (custId, firstName, lastName, state, salesYTD, previousYearsSales ) VALUES ($1, $2, $3, $4, $5, $6);";
    const params = [custId, firstName, lastName, state, salesYTD, previousYearsSales];
    pool.query(sql, params, (err, result) => {
        let message = "";
        if (err) {
            message = `Error- ${err.message}`;
            res.render("createCustomer", {  
                message: message, 
                nextId: custId 
            });
        } else {
            res.redirect("/manageCustomers");
        }
    });
});

app.get("/import", (req, res) => {
    res.render("import");
});

app.post("/import", upload.single("customerFile"), (req, res) => {
    if (!req.file || Object.keys(req.file).length === 0) {
        let message = "Error: Import file not uploaded";
        return res.send(message);
    };
    const buffer = req.file.buffer;
    const lines = buffer.toString().split(/\r?\n/);

    lines.forEach(line => {
        let customer = line.split(",");
        const sql = "INSERT INTO CUSTOMER (custId, firstName, lastName, state, salesYTD, previousYearsSales ) VALUES ($1, $2, $3, $4, $5, $6);";
        pool.query(sql, customer, (err, result) => {
            if (err) {
                console.log(`Error- ${err.message}`);
            } else {
                console.log("Import successful");
            }
        });
    });
    let message = `Importing  Complete - Imported ${lines.length} records.`;
    res.send(message);
});

app.get("/export", (req, res) => {
    let message = "";
    res.render("export", { message: message });
});

app.post("/export", (req, res) => {
    const sql = "SELECT * FROM CUSTOMER ORDER BY custId;";
    pool.query(sql, [], (err, result) => {
        let message = "";   
        if (err) {
            message = `Error- ${err.message}`;
            res.render("export", { message: message });
        } else {
            let output = "";
            result.rows.forEach(customer => {
                output += 
            `${customer.custId},${customer.firstName},${customer.lastName},${customer.state},${customer.salesYTD},${customer.previousYearsSales}\n`;
            });
            res.header("Content-Type", "text/csv");
            res.attachment("export.txt");
            return res.send(output);
        };
    });
});


// Start listener
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started (http://localhost:3000)");
});
