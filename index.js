// Load packages
const express = require("express");
const path = require("path");
const { Client } = require("pg");
const multer = require("multer");
const fs = require("fs");

require("dotenv").config();

// App setup
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// File upload config
const upload = multer({ dest: "uploads/" });

// Database connection
const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/morales_finalproject_db";

const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

client
    .connect()
    .then(() => console.log("✅ Connected to database"))
    .catch(err => console.error("❌ DB connection error:", err));


function parseFile(filePath) {
    const data = fs.readFileSync(filePath, "utf-8");
    return data
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
            const [name, email] = line.split(",");
            return { name: name?.trim(), email: email?.trim() };
        });
}

// Starting the server
app.listen(3000, () => {
  console.log("Server started (http://localhost:3000/) !");
});


// GET Routes

// Home
app.get("/", (req, res) => {
    res.render("index");
});

// Manage Customers
app.get("/manageCustomers", async (req, res) => {
    const result = await client.query("SELECT * FROM customers ORDER BY id");

    res.render("manageCustomers", {
        customers: result.rows,
        totalCount: result.rowCount,
        message: null,
        search: req.query || {}
    });
});

// Create Customer page
app.get("/createCustomer", (req, res) => {
    res.render("createCustomer", {
        message: null
    });
});

app.post("/createCustomer", async (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.render("createCustomer", {
            message: "Name and email are required."
        });
    }

    try {
        await client.query(
            "INSERT INTO customers (name, email) VALUES ($1, $2)",
            [name.trim(), email.trim()]
        );

        res.render("createCustomer", {
            message: "Customer created successfully."
        });

    } catch (err) {
        console.error("Create customer error:", err);

        res.render("createCustomer", {
            message: "Error creating customer. Please try again."
        });
    }
});

// IMPORT
app.get("/import", async (req, res) => {
    const result = await client.query("SELECT COUNT(*) FROM customers");

    res.render("import", {
        totalRecords: result.rows[0].count,
        summary: null,
        error: null
    });
});

app.post("/import", upload.single("customerFile"), async (req, res) => {
    const totalResult = await client.query("SELECT COUNT(*) FROM customers");
    const totalRecords = totalResult.rows[0].count;

    if (!req.file) {
        return res.render("import", {
            totalRecords,
            error: "Please select a file before submitting.",
            summary: null
        });
    }

    const records = parseFile(req.file.path);

    let processed = 0;
    let inserted = 0;
    let failed = 0;
    let errors = [];

    for (const record of records) {
        processed++;

        try {
            await client.query(
                "INSERT INTO customers (name, email) VALUES ($1, $2)",
                [record.name, record.email]
            );
            inserted++;
        } catch (err) {
            failed++;
            errors.push({ record, message: err.message });
        }
    }

    fs.unlinkSync(req.file.path);
    res.render("import", {
        totalRecords,
        error: null,
        summary: {
            processed,
            inserted,
            failed,
            errors
        }
    });
});

// EXPORT
app.get("/export", async (req, res) => {
    const result = await client.query("SELECT COUNT(*) FROM customers");

    res.render("export", {
        totalRecords: result.rows[0].count,
        defaultFilename: "customers_export.txt"
    });
});

app.post("/export", async (req, res) => {
    const filename = req.body.filename?.trim() || "customers_export.txt";

    const result = await client.query(
        "SELECT name, email FROM customers ORDER BY id"
    );

    let fileData = "";
    result.rows.forEach(row => {
        fileData += `${row.name},${row.email}\n`;
    });

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
    );

    res.send(fileData);
});
