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

const getTotalCount = async () => {
    const res = await pool.query("SELECT COUNT(*) FROM CUSTOMER");
    return res.rows[0].count;
};

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

app.get("/manageCustomers", async (req, res) => {
    const totalRecords = await getTotalCount();
    res.render("manageCustomers", { 
        message: "", 
        model: [], 
        totalRecords: totalRecords,
        searchCriteria: {} 
    });
});

app.post("/manageCustomers", (req, res) => {
    const { custId, firstName, lastName, state } = req.body;
    
    let sql = "SELECT * FROM CUSTOMER WHERE 1=1";
    let params = [];

    if (custId) {
        params.push(custId);
        sql += ` AND custId = $${params.length}`;
    }
    if (firstName) {
        params.push(`%${firstName}%`);
        sql += ` AND firstName ILIKE $${params.length}`; 
    }
    if (lastName) {
        params.push(`%${lastName}%`);
        sql += ` AND lastName ILIKE $${params.length}`;
    }
    if (state) {
        params.push(state);
        sql += ` AND state = $${params.length}`;
    }

    pool.query(sql, params, (err, result) => {
        res.render("manageCustomers", {
            model: result.rows,
            searchCriteria: req.body, 
            count: result.rows.length
        });
    });
});

app.get("/createCustomer", async (req, res) => {
    const resId = await pool.query("SELECT MAX(custId) AS maxid FROM CUSTOMER");
    const nextId = (resId.rows[0].maxid || 0) + 1;
    res.render("createCustomer", { message: "", nextId: nextId, formData: {} });
});

app.post("/createCustomer", (req, res) => {
    const { custId, firstName, lastName, state, salesYTD, previousYearsSales } = req.body;
    const sql = "INSERT INTO CUSTOMER (custId, firstName, lastName, state, salesYTD, previousYearsSales) VALUES ($1, $2, $3, $4, $5, $6)";
    const params = [custId, firstName, lastName, state, salesYTD, previousYearsSales];

    pool.query(sql, params, (err, result) => {
        if (err) {
            return res.render("createCustomer", {  
                message: `Error - ${err.message}`, 
                nextId: custId,
                formData: req.body 
            });
        } else {
            res.render("createCustomer", {
                message: "Customer successfully created!",
                nextId: parseInt(custId) + 1, 
                formData: {} 
            });
        }
    });
});

app.get("/editCustomer/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query("SELECT * FROM CUSTOMER WHERE custId = $1", [id]);
        res.render("editCustomer", { 
            customer: result.rows[0], 
            message: "" 
        });
    } catch (err) {
        res.status(500).send("Error loading customer");
    }
});

app.post("/editCustomer/:id", async (req, res) => {
    const id = req.params.id;
    const { firstName, lastName, state, salesYTD, prevSales } = req.body;

    const sql = `UPDATE CUSTOMER 
                 SET firstName = $1, lastName = $2, state = $3, 
                     salesYTD = $4, previousYearsSales = $5 
                 WHERE custId = $6`;
    const params = [firstName, lastName, state, salesYTD, prevSales, id];

    try {
        await pool.query(sql, params);
        const result = await pool.query("SELECT * FROM CUSTOMER WHERE custId = $1", [id]);
        res.render("editCustomer", { 
            customer: result.rows[0], 
            message: "Customer updated successfully!" 
        });
    } catch (err) {
        res.render("editCustomer", { 
            customer: req.body,
            message: `Error updating record: ${err.message}` 
        });
    }
});

app.get("/deleteCustomer/:id", async (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM CUSTOMER WHERE custId = $1";
    
    try {
        const result = await pool.query(sql, [id]);
        res.render("deleteCustomer", { customer: result.rows[0] });
    } catch (err) {
        res.status(500).send("Error retrieving customer: " + err.message);
    }
});

app.post("/deleteCustomer/:id", async (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM CUSTOMER WHERE custId = $1";
    
    try {
        await pool.query(sql, [id]);
        const countResult = await pool.query("SELECT COUNT(*) FROM CUSTOMER");
        res.render("manageCustomers", {
            message: "Customer successfully deleted.",
            model: [], 
            totalRecords: countResult.rows[0].count,
            searchCriteria: {}
        });
    } catch (err) {
        res.send("Error deleting record: " + err.message);
    }
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

app.post("/import", upload.single("customerFile"), async (req, res) => {
    if (!req.file) return res.send("Error: No file uploaded");

    const lines = req.file.buffer.toString().split(/\r?\n/).filter(line => line.trim() !== "");
    let total = 0, success = 0, failed = 0;
    let errorDetails = [];

    for (const line of lines) {
        total++;
        let customer = line.split(","); 
        
        const sql = "INSERT INTO CUSTOMER (custId, firstName, lastName, state, salesYTD, previousYearsSales) VALUES ($1, $2, $3, $4, $5, $6)";
        
        try {
            await pool.query(sql, customer);
            success++;
        } catch (err) {
            failed++;
            errorDetails.push(`Record ${total} (ID: ${customer[0]}): ${err.message}`);
        }
    }

    res.render("importSummary", { 
        total, success, failed, errorDetails 
    });
});

app.post("/export", async (req, res) => {
    const fileName = req.body.filename || "export.txt";
    
    const sql = "SELECT * FROM CUSTOMER ORDER BY custId";
    
    try {
        const result = await pool.query(sql);
                
        let output = "";
        result.rows.forEach(customer => {
            output += `${customer.custid},${customer.firstname},${customer.lastname},${customer.state},${customer.salesytd},${customer.previousyearssales}\n`;
        });
        
        res.header("Content-Type", "text/plain");
        res.attachment(fileName);
        return res.send(output);

    } catch (err) {
        const countRes = await pool.query("SELECT COUNT(*) FROM CUSTOMER");
        res.render("export", {
            totalRecords: countRes.rows[0].count,
            message: `Error: ${err.message}`
        });
    }
});

// Start listener
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started (http://localhost:3000)");
});
