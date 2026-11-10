-- ============================================================================
-- ATTENDLY: Smart Student Attendance & Management System
-- Database Schema (Compatible with PostgreSQL & MySQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    hod_name VARCHAR(120)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    roll_or_emp_id VARCHAR(50) NOT NULL UNIQUE,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    year INTEGER DEFAULT 3,
    semester INTEGER DEFAULT 5,
    parent_name VARCHAR(120),
    parent_email VARCHAR(150),
    parent_phone VARCHAR(30),
    notify_parent_email BOOLEAN DEFAULT TRUE,
    notify_redline_alerts BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL,
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    schedule_slot VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Present', 'Absent')),
    marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    remarks VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS daily_absence_notifications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    absence_date DATE NOT NULL,
    parent_email VARCHAR(150) NOT NULL,
    total_classes_scheduled INTEGER NOT NULL,
    total_classes_absent INTEGER NOT NULL,
    email_subject VARCHAR(255) NOT NULL,
    email_body TEXT NOT NULL,
    delivery_status VARCHAR(30) DEFAULT 'Sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, absence_date)
);

CREATE TABLE IF NOT EXISTS redline_notifications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('WARNING_BELOW_75', 'RECOVERY_ABOVE_75')),
    attendance_percentage DECIMAL(5,2) NOT NULL,
    classes_needed INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doubts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    attachment_name VARCHAR(255),
    attachment_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Answered', 'Resolved')),
    teacher_reply TEXT,
    replied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings_feedback (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction VARCHAR(30) NOT NULL CHECK (direction IN ('student_to_teacher', 'teacher_to_student')),
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    metric_1_score INTEGER NOT NULL CHECK (metric_1_score BETWEEN 1 AND 5),
    metric_2_score INTEGER NOT NULL CHECK (metric_2_score BETWEEN 1 AND 5),
    metric_3_score INTEGER NOT NULL CHECK (metric_3_score BETWEEN 1 AND 5),
    overall_score DECIMAL(3,2) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_explanations (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    absence_date DATE NOT NULL,
    reason_category VARCHAR(50) NOT NULL CHECK (reason_category IN ('Medical Emergency', 'Health Issues', 'Family Emergency', 'Personal Reasons', 'Other')),
    explanation_text TEXT NOT NULL,
    document_name VARCHAR(255),
    document_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewer_comment TEXT,
    convert_to_present BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
