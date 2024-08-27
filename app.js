const express = require('express');
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');
const mysql = require('mysql2');
const ExcelJS = require('exceljs');

const app = express();
const cors = require('cors');
app.use(cors());

// Middleware to parse the body of the request

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    database: 'isy',
    password: '123456',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.get('/download-student-details', (req, res) => {
    // Define the query to fetch student details
    const query = `
        SELECT id, name, email, rollno, active
        FROM students;
    `;

    pool.query(query, async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error fetching student details for download');
        }

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Student Details');

        // Define columns
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Roll No', key: 'rollno', width: 15 },
            { header: 'Status', key: 'active', width: 10 },
        ];

        // Map active status to human-readable values
        results.forEach(student => {
            student.active = student.active === 1 ? 'Active' : 'Blocked';
        });

        // Add rows to the worksheet
        worksheet.addRows(results);

        // Set the HTTP headers to prompt a download on the client side
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="student_details.xlsx"');

        // Write workbook to the response
        await workbook.xlsx.write(res).then(() => {
            res.status(200).end();
        }).catch(error => {
            console.error('Error writing Excel file:', error);
            res.status(500).send('Failed to download Excel file.');
        });
    });
});


// Endpoint to download NGO details
app.get('/download-ngo-details', (req, res) => {
    // Define the query to fetch NGO details
    const query = `
        SELECT id, orgName, contactPerson, contactInfo, description, email, password, active
        FROM ngos;
    `;

    pool.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error fetching NGO details for download');
        }

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('NGO Details');

        // Define columns based on the data fetched
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Organization Name', key: 'orgName', width: 30 },
            { header: 'Contact Person', key: 'contactPerson', width: 30 },
            { header: 'Contact Info', key: 'contactInfo', width: 30 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Status', key: 'active', width: 10 },
        ];

        results.forEach(ngo => {
            ngo.active = ngo.active === 1 ? 'Active' : 'Blocked';
        });

        // Add rows to the worksheet
        worksheet.addRows(results);

        // Set the HTTP headers to prompt a download on the client side
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="ngo_details.xlsx"');

        // Write workbook to the response
        workbook.xlsx.write(res)
            .then(() => {
                res.status(200).end();
            })
            .catch(error => {
                console.error('Error writing Excel file:', error);
                res.status(500).send('Failed to download NGO details.');
            });
    });
});

// Endpoint to download Project details
app.get('/download-project-details', (req, res) => {
    // Define the query to fetch Project details
    const query = `
        SELECT job_id, project_name, duration, required_skills, about_ngo, contact, ngo_id, 
               CASE WHEN status = 1 THEN 'Open' ELSE 'Closed' END AS status
        FROM projects;
    `;

    pool.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error fetching Project details for download');
        }

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Project Details');

        // Define columns based on the data fetched
        worksheet.columns = [
            { header: 'Job ID', key: 'job_id', width: 10 },
            { header: 'Project Name', key: 'project_name', width: 30 },
            { header: 'Duration', key: 'duration', width: 20 },
            { header: 'Required Skills', key: 'required_skills', width: 30 },
            { header: 'About NGO', key: 'about_ngo', width: 50 },
            { header: 'Contact', key: 'contact', width: 30 },
            { header: 'NGO ID', key: 'ngo_id', width: 10 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        // Add rows to the worksheet
        worksheet.addRows(results);

        // Set the HTTP headers to prompt a download on the client side
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="project_details.xlsx"');

        // Write workbook to the response
        workbook.xlsx.write(res)
            .then(() => {
                res.status(200).end();
            })
            .catch(error => {
                console.error('Error writing Excel file:', error);
                res.status(500).send('Failed to download Project details.');
            });
    });
});


app.post('/ban-ngo', (req, res) => {
    const { ngoId } = req.body;

    if (!ngoId) {
        return res.status(400).send("NGO ID is required.");
    }

    // Queries
    const updateNgoQuery = `
        UPDATE ngos
        SET active = 0
        WHERE id = ?;
    `;

    const removeStudentProjectsQuery = `
        DELETE FROM student_project
        WHERE project_id IN (SELECT job_id FROM projects WHERE ngo_id = ?);
    `;

    const removeProjectsQuery = `
        DELETE FROM projects
        WHERE ngo_id = ?;
    `;

    // Transaction to execute all queries atomically
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting database connection:', err);
            return res.status(500).send('Error banning NGO.');
        }

        connection.beginTransaction(err => {
            if (err) {
                console.error('Error starting transaction:', err);
                connection.release();
                return res.status(500).send('Error banning NGO.');
            }

            // Remove entries from student_project first
            connection.query(removeStudentProjectsQuery, [ngoId], (err, result) => {
                if (err) {
                    console.error('Error removing student projects:', err);
                    return connection.rollback(() => {
                        connection.release();
                        res.status(500).send('Error banning NGO.');
                    });
                }

                // Then remove projects
                connection.query(removeProjectsQuery, [ngoId], (err, result) => {
                    if (err) {
                        console.error('Error removing NGO projects:', err);
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).send('Error banning NGO.');
                        });
                    }

                    // Finally, update the NGO status
                    connection.query(updateNgoQuery, [ngoId], (err, result) => {
                        if (err) {
                            console.error('Error updating NGO status:', err);
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).send('Error banning NGO.');
                            });
                        }

                        // Commit the transaction if all queries are successful
                        connection.commit(err => {
                            if (err) {
                                console.error('Error committing transaction:', err);
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).send('Error banning NGO.');
                                });
                            }

                            connection.release();
                            res.status(200).send('NGO banned successfully.');
                        });
                    });
                });
            });
        });
    });
});


app.post('/ban-student', (req, res) => {
    const { studentId } = req.body;

    if (!studentId) {
        return res.status(400).send("Student ID is required.");
    }

    // SQL Queries
    const deactivateStudentQuery = `
        UPDATE students
        SET active = 0
        WHERE id = ?;
    `;

    const deleteStudentProjectsQuery = `
        DELETE FROM student_project
        WHERE student_id = ?;
    `;

    // Transaction to execute all queries atomically
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting database connection:', err);
            return res.status(500).send('Error banning student.');
        }

        connection.beginTransaction(err => {
            if (err) {
                console.error('Error starting transaction:', err);
                connection.release();
                return res.status(500).send('Error banning student.');
            }

            // First, deactivate the student
            connection.query(deactivateStudentQuery, [studentId], (err, result) => {
                if (err) {
                    console.error('Error deactivating student:', err);
                    return connection.rollback(() => {
                        connection.release();
                        res.status(500).send('Error banning student.');
                    });
                }

                // Then delete the student's projects
                connection.query(deleteStudentProjectsQuery, [studentId], (err, result) => {
                    if (err) {
                        console.error('Error deleting student projects:', err);
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).send('Error banning student.');
                        });
                    }

                    // Commit the transaction if all queries are successful
                    connection.commit(err => {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).send('Error banning student.');
                            });
                        }

                        connection.release();
                        res.status(200).send('Student banned successfully.');
                    });
                });
            });
        });
    });
});

app.get('/download-comprehensive-report', (req, res) => {
    const query = `
        SELECT sp.student_id, sp.project_id, sp.student_name, sp.skills, sp.email_id,
               p.project_name, p.duration, p.required_skills, p.about_ngo, p.contact, p.ngo_id,
               n.orgName, n.contactPerson, n.contactInfo
        FROM student_project sp
        JOIN projects p ON sp.project_id = p.job_id
        JOIN ngos n ON p.ngo_id = n.id
        WHERE sp.final = 1;
    `;

    pool.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error fetching comprehensive report details');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Comprehensive Report');

        worksheet.columns = [
            { header: 'Student ID', key: 'student_id', width: 15 },
            { header: 'Project ID', key: 'project_id', width: 15 },
            { header: 'Student Name', key: 'student_name', width: 25 },
            { header: 'Skills', key: 'skills', width: 20 },
            { header: 'Email ID', key: 'email_id', width: 25 },
            { header: 'Project Name', key: 'project_name', width: 20 },
            { header: 'Duration', key: 'duration', width: 10 },
            { header: 'Required Skills', key: 'required_skills', width: 20 },
            { header: 'About NGO', key: 'about_ngo', width: 30 },
            { header: 'NGO Contact', key: 'contact', width: 20 },
            { header: 'NGO ID', key: 'ngo_id', width: 10 },
            { header: 'NGO Name', key: 'orgName', width: 20 },
            { header: 'Contact Person', key: 'contactPerson', width: 20 },
            { header: 'Contact Info', key: 'contactInfo', width: 20 }
        ];

        worksheet.addRows(results);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="comprehensive_report.xlsx"');

        workbook.xlsx.write(res)
            .then(() => {
                res.status(200).end();
            })
            .catch(error => {
                console.error('Error writing Excel file:', error);
                res.status(500).send('Failed to download comprehensive report.');
            });
    });
});

app.get('/download-unsatisfactory-report', (req, res) => {
    const query = `
        SELECT sp.student_id, sp.project_id, sp.student_name, sp.skills, sp.email_id,
               p.project_name, p.duration, p.required_skills, p.about_ngo, p.contact, p.ngo_id,
               n.orgName, n.contactPerson, n.contactInfo
        FROM student_project sp
        JOIN projects p ON sp.project_id = p.job_id
        JOIN ngos n ON p.ngo_id = n.id
        WHERE sp.status = 'Unsatisfactory';
    `;


    pool.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error fetching unsatisfactory report details');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Unsatisfactory Report');

        worksheet.columns = [
            { header: 'Student ID', key: 'student_id', width: 15 },
            { header: 'Project ID', key: 'project_id', width: 15 },
            { header: 'Student Name', key: 'student_name', width: 25 },
            { header: 'Skills', key: 'skills', width: 20 },
            { header: 'Email ID', key: 'email_id', width: 25 },
            { header: 'Project Name', key: 'project_name', width: 20 },
            { header: 'Duration', key: 'duration', width: 10 },
            { header: 'Required Skills', key: 'required_skills', width: 20 },
            { header: 'About NGO', key: 'about_ngo', width: 30 },
            { header: 'NGO Contact', key: 'contact', width: 20 },
            { header: 'NGO ID', key: 'ngo_id', width: 10 },
            { header: 'NGO Name', key: 'orgName', width: 20 },
            { header: 'Contact Person', key: 'contactPerson', width: 20 },
            { header: 'Contact Info', key: 'contactInfo', width: 20 }
        ];

        worksheet.addRows(results);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="unsatisfactory_report.xlsx"');

        workbook.xlsx.write(res)
            .then(() => {
                res.status(200).end();
            })
            .catch(error => {
                console.error('Error writing Excel file:', error);
                res.status(500).send('Failed to download unsatisfactory report.');
            });
    });
});


app.get('/download-cw-report', (req, res) => {
    const query = `
        SELECT sp.student_id, sp.project_id, sp.student_name, sp.skills, sp.email_id,
               p.project_name, p.duration, p.required_skills, p.about_ngo, p.contact, p.ngo_id,
               n.orgName, n.contactPerson, n.contactInfo
        FROM student_project sp
        JOIN projects p ON sp.project_id = p.job_id
        JOIN ngos n ON p.ngo_id = n.id
        WHERE sp.final = 1 and sp.status = 'Satisfactory';
    `;

    pool.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error fetching cw report details');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CW Report');

        worksheet.columns = [
            { header: 'Student ID', key: 'student_id', width: 15 },
            { header: 'Project ID', key: 'project_id', width: 15 },
            { header: 'Student Name', key: 'student_name', width: 25 },
            { header: 'Skills', key: 'skills', width: 20 },
            { header: 'Email ID', key: 'email_id', width: 25 },
            { header: 'Project Name', key: 'project_name', width: 20 },
            { header: 'Duration', key: 'duration', width: 10 },
            { header: 'Required Skills', key: 'required_skills', width: 20 },
            { header: 'About NGO', key: 'about_ngo', width: 30 },
            { header: 'NGO Contact', key: 'contact', width: 20 },
            { header: 'NGO ID', key: 'ngo_id', width: 10 },
            { header: 'NGO Name', key: 'orgName', width: 20 },
            { header: 'Contact Person', key: 'contactPerson', width: 20 },
            { header: 'Contact Info', key: 'contactInfo', width: 20 }
        ];

        worksheet.addRows(results);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Cw_report.xlsx"');

        workbook.xlsx.write(res)
            .then(() => {
                res.status(200).end();
            })
            .catch(error => {
                console.error('Error writing Excel file:', error);
                res.status(500).send('Failed to download comprehensive report.');
            });
    });
});




app.get('/download-applications', (req, res) => {
    const projectId = req.query.jobId;

    if (!projectId) {
        return res.status(400).send("Project ID is required.");
    }

    // Define the query to get data
    const query = `
        SELECT student_name, skills, email_id, status
        FROM student_project 
        JOIN students ON student_project.student_id = students.id
        WHERE project_id = ?;
    `;

    pool.query(query, [projectId], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error fetching applications for download');
        }

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Applications');

        // Define columns based on the data fetched
        worksheet.columns = [
            { header: 'Student Name', key: 'student_name', width: 30 },
            { header: 'Skills', key: 'skills', width: 20 },
            { header: 'Email ID', key: 'email_id', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        // Add rows to the worksheet
        worksheet.addRows(results);

        // Set the HTTP headers to prompt a download on the client side
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="applications.xlsx"');

        // Write workbook to the response
        await workbook.xlsx.write(res).then(() => {
            res.status(200).end();
        }).catch(error => {
            console.error('Error writing Excel file:', error);
            res.status(500).send('Failed to download Excel file.');
        });
    });
});


// Endpoint to check if an email already exists in the database
app.get('/check-email', (req, res) => {
    const email = req.query.email;
    pool.query(
        'SELECT COUNT(*) AS count FROM students WHERE email = ?',
        [email],
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error checking email' });
            }
            res.json({ exists: results[0].count > 0 });
        }
    );
});

// Endpoint to check if a roll number already exists in the database
app.get('/check-rollno', (req, res) => {
    const rollno = req.query.rollno;
    pool.query(
        'SELECT COUNT(*) AS count FROM students WHERE rollno = ?',
        [rollno],
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error checking roll number' });
            }
            res.json({ exists: results[0].count > 0 });
        }
    );
});

// NGO signup route with OTP validation
app.post('/signup-ngo', [
    body('org').not().isEmpty().withMessage('Organization Name is required'),
    body('contact').not().isEmpty().withMessage('Contact Person is required'),
    body('info').not().isEmpty().withMessage('Contact Information is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('otp').equals('1234').withMessage('Invalid OTP')  // Validate OTP here
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { org, contact, info, description, email, password } = req.body;

    pool.execute(
        'INSERT INTO ngos (orgName, contactPerson, contactInfo, description, email, password, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [org, contact, info, description, email, password, true],
        (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: 'An account with this email already exists.' });
                }
                console.error(err);
                return res.status(500).json({ message: 'Error during record insertion', error: err.message });
            }
            res.redirect('http://localhost:63342/isyfinal/public/index.html?_ijt=fi2pts3mhg23vgu0pgb4l6sh4e');

        }
    );
});

// NGO login route
app.post('/login-ngo', [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').exists().withMessage('Password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    pool.query(
        'SELECT * FROM ngos WHERE email = ? AND password = ? AND active = ?',
        [email, password, true], // Ensure active is true
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error during login' });
            }
            if (results.length > 0) {
                const loggedInNgo = results[0];
                res.redirect(`http://localhost:63342/isyfinal/public/NGOdashboard.html?ngoId=${loggedInNgo.id}&ngoName=${loggedInNgo.orgName}`);
            } else {
                res.status(401).json({ message: 'Login failed: NGO does not exist, password is incorrect, or NGO is not active' });
            }
        }
    );
});

// Utility function to get NGO ID
const getNgoIdByOrgName = (orgName) => {
    return new Promise((resolve, reject) => {
        pool.query(
            'SELECT id FROM ngos WHERE orgName = ? LIMIT 1',
            [orgName],
            (err, results) => {
                if (err) {
                    return reject(err);
                }
                if (results.length > 0) {
                    return resolve(results[0].id); // Return the found NGO ID
                } else {
                    return reject(new Error('No NGO found with the given name'));
                }
            }
        );
    });
};

// Endpoint to create a new project
app.post('/create-project', async (req, res) => {
    const { projectName, duration, requiredSkills, aboutNgo, contact, orgName } = req.body;
    console.log('Received orgName:', orgName); // This will show you what orgName the endpoint is receiving


    try {
        // Get NGO ID from the orgName
        const ngoId = await getNgoIdByOrgName(orgName);

        // Insert project with the obtained NGO ID
        pool.execute(
            'INSERT INTO projects (project_name, duration, required_skills, about_ngo, contact, ngo_id) VALUES (?, ?, ?, ?, ?, ?)',
            [projectName, duration, requiredSkills, aboutNgo, contact, ngoId],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: 'Error during project creation', error: err.message });
                }
                res.status(201).json({ message: 'Project created successfully' });
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});


// Fetch all projects for a specific NGO
app.get('/projects', (req, res) => {
    const ngoId = req.query.ngoId; // Get NGO ID from query parameter
    if (!ngoId) {
        return res.status(400).json({ message: 'NGO ID is required' });
    }

    pool.query('SELECT * FROM projects WHERE ngo_id = ?', [ngoId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error fetching projects', error: err.message });
        }
        res.json(results);
    });
});

// Fetch all projects for a specific NGO
app.get('/project_students', (req, res) => {
    // Only select projects where the status is not '0' (assuming '0' means closed)
    const query = `
        SELECT projects.*, ngos.orgName 
        FROM projects 
        JOIN ngos ON projects.ngo_id = ngos.id
        WHERE projects.status != 0;
    `;

    pool.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            res.status(500).send('Error fetching projects');
        } else {
            res.json(results);
        }
    });
});






// Admin login route
app.post('/login-admin', [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').exists().withMessage('Password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    pool.query(
        'SELECT * FROM admins WHERE email = ? AND password = ?', // Assuming you have a 'password' column in the 'admins' table
        [email, password],
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error during login' });
            }
            if (results.length > 0) {
                const loggedInAdmin = results[0];
                // res.json({ message: 'Login successful', admin: loggedInAdmin });
                res.redirect('http://localhost:63342/isyfinal/public/adminDashboard.html')
            } else {
                res.status(401).json({ message: 'Login failed: admin does not exist or password is incorrect' });
            }
        }
    );
});



/// Student login route
app.post('/login-student', [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').exists().withMessage('Password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    pool.query(
        'SELECT * FROM students WHERE email = ? AND password = ? AND active = ?',
        [email, password, true], // Ensure active is true
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error during login' });
            }
            if (results.length > 0) {
                const loggedInUser = results[0];
                res.redirect(`http://localhost:63342/isyfinal/public/studentDashboard.html?Id=${loggedInUser.id}&Name=${loggedInUser.name}&Email=${loggedInUser.email}&RollNo=${loggedInUser.rollno}`);

            } else {
                res.status(401).json({ message: 'Login failed: user does not exist, password is incorrect, or user is not active' });
            }
        }
    );
});




// Student signup route
app.post('/signup', [
    body('name').not().isEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email address').custom((email) => {
        if (!email.endsWith('@iiitd.ac.in')) {
            throw new Error('Email must end with @iiitd.ac.in');
        }
        return true;
    }),
    body('rollno').isLength({ min: 7, max: 7 }).withMessage('Roll No must be 7 digits').isNumeric().withMessage('Roll No must be numeric'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, rollno, password } = req.body;

    pool.execute(
        'INSERT INTO students (name, email, rollno, password, active) VALUES (?, ?, ?, ?, ?)',
        [name, email, rollno, password, true],
        (err, results) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: 'An account with the given email or roll number already exists.' });
                }
                console.error(err);
                return res.status(500).json({ message: 'Error during record insertion' });
            }
            res.redirect('http://localhost:63342/isyfinal/public/index.html?_ijt=fi2pts3mhg23vgu0pgb4l6sh4e');
        }
    );
});

app.get('/applications', (req, res) => {
    const projectId = req.query.jobId;
    if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required' });
    }

    console.log('Received project ID:', projectId);

    // Modified query to filter by status 'Applied'
    pool.query(
        `SELECT student_id, student_name, skills, email_id, status 
         FROM student_project 
         JOIN students ON student_project.student_id = students.id
         WHERE project_id = ? AND status = 'Applied'`, // Only select applications with 'Applied' status
        [projectId],
        (err, results) => {
            if (err) {
                console.error('Database error fetching applications:', err);
                return res.status(500).json({ message: 'Database error fetching applications' });
            }
            console.log('Applications results:', results);
            res.json(results);
        }
    );
});

app.post('/close-project/:jobId', (req, res) => {
    const { jobId } = req.params;

    pool.query(
        'UPDATE projects SET status = 0 WHERE job_id = ?',
        [jobId],
        (err, results) => {
            if (err) {
                console.error('Error updating project status:', err);
                return res.status(500).json({ message: 'Database error closing project' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ message: 'Project not found or already closed' });
            }
            res.json({ message: 'Project closed successfully' });
        }
    );
});


app.get('/final-applications', (req, res) => {
    const projectId = req.query.jobId;
    if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required' });
    }

    pool.query(
        `SELECT student_id, student_name, skills, email_id, status 
         FROM student_project 
         JOIN students ON student_project.student_id = students.id
         WHERE project_id = ? AND final = 1`,
        [projectId],
        (err, results) => {
            if (err) {
                console.error('Database error fetching applications:', err);
                return res.status(500).json({ message: 'Database error fetching applications' });
            }
            console.log('Applications results:', results);
            res.json(results);
        }
    );
});

app.post('/update-project-status-final', (req, res) => {
    const { projectId, studentId, status } = req.body;

    pool.query(
        'UPDATE student_project SET status = ? WHERE project_id = ? AND student_id = ?',
        [status, projectId, studentId],
        (err, results) => {
            if (err) {
                console.error('Failed to update project status:', err);
                return res.status(500).send('Error updating project status');
            }
            res.json({ message: `Project status updated to ${status}` });
        }
    );
});

// Route to update application status
app.post('/update-application-status', (req, res) => {
    const applicationId = req.body.applicationId;
    const studentId = req.body.studentId;
    const status = req.body.status;


    pool.query(
        'UPDATE student_project SET status = ? WHERE project_id = ? AND student_id = ?', // Updated WHERE clause
        [status, applicationId, studentId],
        (err, results) => {
            if (err) {
                console.error('Updating.....', err);
                res.sendStatus(500); // Internal server error
            } else {
                res.sendStatus(200); // Success
            }
        }
    );
});

// Route to delete a project
app.delete('/projectsdel/:jobId', (req, res) => {
    const { jobId } = req.params;

    // First, delete any dependent student projects
    pool.query(
        'DELETE FROM student_project WHERE project_id = ?',
        [jobId],
        (err, results) => {
            if (err) {
                console.error('Error deleting dependent student projects:', err);
                return res.status(500).json({ message: 'Database error during deletion of dependent student projects', error: err.message });
            }

            // Then, delete the project
            pool.query(
                'DELETE FROM projects WHERE job_id = ?',
                [jobId],
                (err, results) => {
                    if (err) {
                        console.error('Error deleting project:', err);
                        return res.status(500).json({ message: 'Database error during project deletion', error: err.message });
                    }
                    if (results.affectedRows === 0) {
                        return res.status(404).json({ message: 'No project found with the given ID' });
                    }
                    res.status(200).json({ message: 'Project deleted successfully' });
                }
            );
        }
    );
});

app.post('/submit-application', (req, res) => {
    const { studentId, studentName, email, projectId, skills, status, final } = req.body;

    // Connect to database and insert the application
    const query = `INSERT INTO student_project (student_id, project_id, student_name, skills, email_id, status, final) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    pool.query(query, [studentId, projectId, studentName, skills, email, status, final], (err, result) => {
        if (err) {
            console.error('Failed to insert application:', err);
            res.status(500).send('Error processing application');
            return;
        }
        res.send({ message: 'Application submitted successfully' });
    });
});

app.get('/check-application', (req, res) => {
    const { studentId, projectId } = req.query;

    // Replace this with your actual query to check the application status
    const query = `SELECT COUNT(*) as count FROM student_project WHERE student_id = ? AND project_id = ?`;
    pool.query(query, [studentId, projectId], (err, results) => {
        if (err) {
            console.error('Error checking application status:', err);
            res.status(500).send('Error checking application status');
            return;
        }
        res.send({ applied: results[0].count > 0 });
    });
});


app.get('/applied-projects', (req, res) => {
    const studentId = req.query.studentId;

    const query = `
    SELECT
        p.job_id AS project_id,
        p.project_name,
        p.duration,
        p.required_skills,
        p.about_ngo,
        p.contact,
        sp.skills AS applied_skills,
        n.orgName AS ngo_name,
        sp.status
    FROM
        student_project sp
    JOIN
        projects p ON sp.project_id = p.job_id
    JOIN
        ngos n ON p.ngo_id = n.id
    WHERE
        sp.student_id = ?
    ORDER BY
        CASE sp.status
            WHEN 'Satisfactory' THEN 1
            WHEN 'Complete' THEN 2
            WHEN 'Accepted' THEN 3
            WHEN 'Accepted by NGO' THEN 4
            WHEN 'Applied' THEN 5
            WHEN 'Rejected' THEN 6
            ELSE 7
        END ASC;
`;


    pool.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Failed to get applied projects:', err);
            // Send a JSON-formatted error response
            res.status(500).json({ error: 'Error fetching applied projects' });
            return;
        }
        res.json(results);
    });
});



app.post('/update-application-status-student', (req, res) => {
    // Extract data from request body
    const { studentId, projectId, status } = req.body;
    console.log('Student ID:', studentId);
    console.log('Project ID:', projectId);
    console.log('Status:', status);

    // Convert studentId and projectId to integers
    const studentIdint = parseInt(studentId);
    const projectIdint = parseInt(projectId);

    // Determine the value of 'final' based on the 'status'
    let final = 0; // Default is 0 (false)
    if (status === 'Accepted') {
        final = 1; // Set to 1 (true) if status is 'Accepted'
    }

    const updateQuery = `
        UPDATE student_project
        SET status = ?, final = ?
        WHERE student_id = ? AND project_id = ?;
    `;

    // Execute the SQL query to update the application status
    pool.query(updateQuery, [status, final, studentIdint, projectIdint], (err, result) => {
        if (err) {
            console.error('Failed to update application status:', err);
            res.status(500).send('Error updating application status');
            return;
        }

        // If the status is 'Accepted', reject other 'Accepted by NGO' offers and 'Applied' applications
        if (status === 'Accepted') {
            const rejectOtherApplicationsQuery = `
                UPDATE student_project
                SET status = 'Rejected by Student'
                WHERE student_id = ? AND project_id != ? AND status IN ('Accepted by NGO', 'Applied');
            `;

            pool.query(rejectOtherApplicationsQuery, [studentIdint, projectIdint], (err, result) => {
                if (err) {
                    console.error('Failed to reject other applications:', err);
                    res.status(500).send('Error rejecting other applications');
                    return;
                }

                res.send({ message: 'Application status updated successfully, and other applications rejected.' });
            });
        } else {
            res.send({ message: 'Application status updated successfully' });
        }
    });
});

app.get('/all-applications', (req, res) => {
    const projectId = req.query.projectId;
    if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required' });
    }

    pool.query(
        `SELECT student_name, skills, email_id, status
         FROM student_project JOIN students ON student_project.student_id = students.id
         WHERE project_id = ?`,
        [projectId],
        (err, results) => {
            if (err) {
                console.error('Database error fetching all applications:', err);
                return res.status(500).json({ message: 'Database error', error: err.message });
            }
            res.json(results);
        }
    );
});


const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));





// const express = require('express');
// const bodyParser = require('body-parser');
// const { body, validationResult } = require('express-validator');
// const mysql = require('mysql2');
//
// const app = express();
// const cors = require('cors');
// app.use(cors());
//
// // Middleware to parse the body of the request
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
//
// // Database connection pool
// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     database: 'isy',
//     password: '123456',
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// });
//
// // Serve static files from the 'public' directory
// app.use(express.static('public'));
//
// // Endpoint to check if an email already exists in the database
// app.get('/check-email', (req, res) => {
//     const email = req.query.email;
//     pool.query('SELECT COUNT(*) AS count FROM students WHERE email = ?', [email], (err, results) => {
//         if (err) {
//             return res.status(500).json({ message: 'Database error checking email' });
//         }
//         res.json({ exists: results[0].count > 0 });
//     });
// });
//
// // Endpoint to check if a roll number already exists in the database
// app.get('/check-rollno', (req, res) => {
//     const rollno = req.query.rollno;
//     pool.query('SELECT COUNT(*) AS count FROM students WHERE rollno = ?', [rollno], (err, results) => {
//         if (err) {
//             return res.status(500).json({ message: 'Database error checking roll number' });
//         }
//         res.json({ exists: results[0].count > 0 });
//     });
// });
//
// // NGO signup route with OTP validation
// app.post('/signup-ngo', [
//     body('org').not().isEmpty().withMessage('Organization Name is required'),
//     body('contact').not().isEmpty().withMessage('Contact Person is required'),
//     body('info').not().isEmpty().withMessage('Contact Information is required'),
//     body('email').isEmail().withMessage('Invalid email address'),
//     body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
//     body('otp').equals('1234').withMessage('Invalid OTP')
// ], (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//     }
//
//     const { org, contact, info, description, email, password } = req.body;
//     pool.execute('INSERT INTO ngos (orgName, contactPerson, contactInfo, description, email, password, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
//         [org, contact, info, description, email, password, true], (err, results) => {
//             if (err) {
//                 if (err.code === 'ER_DUP_ENTRY') {
//                     return res.status(409).json({ message: 'An account with this email already exists.' });
//                 }
//                 return res.status(500).json({ message: 'Error during record insertion', error: err.message });
//             }
//             res.status(201).json({ message: 'Registered successfully. Please login.' });
//         }
//     );
// });
//
// // NGO login route
// app.post('/login-ngo', [
//     body('email').isEmail().withMessage('Invalid email format'),
//     body('password').exists().withMessage('Password is required')
// ], (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//     }
//
//     const { email, password } = req.body;
//     pool.query('SELECT * FROM ngos WHERE email = ? AND password = ? AND active = ?', [email, password, true], (err, results) => {
//         if (err) {
//             return res.status(500).json({ message: 'Database error during login' });
//         }
//         if (results.length > 0) {
//             const loggedInNgo = results[0];
//             // Sending NGO ID back to the client to be stored locally (consider using session storage or JWTs for a more secure approach)
//
//             // res.json({
//             //     message: 'Login successful',
//             //     ngoId: loggedInNgo.id, // Return NGO ID to the client
//             //     ngoName: loggedInNgo.orgName
//             // });
//             res.redirect(`http://localhost:63342/isyfinal/public/NGOdashboard.html?ngoId=${encodeURIComponent(loggedInNgo.id)}&ngoName=${encodeURIComponent(loggedInNgo.orgName)}`);
//
//
//
//         }
//         else {
//
//             res.status(401).json({ message: 'Login failed: NGO does not exist, password is incorrect, or NGO is not active' });
//         }
//     });
// });
//
// // Endpoint to fetch all projects for a specific NGO
// app.get('/projects', (req, res) => {
//     const ngoId = req.query.ngoId; // Get NGO ID from query parameter
//     if (!ngoId) {
//         return res.status(400).json({ message: 'NGO ID is required' });
//     }
//
//     pool.query('SELECT * FROM projects WHERE ngo_id = ?', [ngoId], (err, results) => {
//         if (err) {
//             return res.status(500).json({ message: 'Database error fetching projects', error: err.message });
//         }
//         res.json(results);
//     });
// });
//
// // Endpoint to create a new project
// app.post('/create-project', async (req, res) => {
//     const { projectName, duration, requiredSkills, aboutNgo, contact, orgName } = req.body;
//     try {
//         // Get NGO ID from the orgName provided
//         const ngoId = await getNgoIdByOrgName(orgName);
//
//         // Insert project with the obtained NGO ID
//         pool.execute('INSERT INTO projects (project_name, duration, required_skills, about_ngo, contact, ngo_id) VALUES (?, ?, ?, ?, ?, ?)',
//             [projectName, duration, requiredSkills, aboutNgo, contact, ngoId], (err, results) => {
//                 if (err) {
//                     console.error(err);
//                     return res.status(500).json({ message: 'Error during project creation', error: err.message });
//                 }
//                 res.status(201).json({ message: 'Project created successfully' });
//             }
//         );
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: error.message });
//     }
// });
//
// // Standard routes for admin and student login and signup are assumed to be correctly handled similarly.
//
// const PORT = 3000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
