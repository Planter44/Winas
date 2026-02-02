-- Create messages table for internal messaging system
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_broadcast BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create message recipients table (for individual messages)
CREATE TABLE IF NOT EXISTS message_recipients (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, recipient_id)
);

-- Create message broadcast groups (for department/role-based broadcasts)
CREATE TABLE IF NOT EXISTS message_broadcast_groups (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    department_id INTEGER REFERENCES departments(id),
    role_id INTEGER REFERENCES roles(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient ON message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_message ON message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_read ON message_recipients(is_read);
CREATE INDEX IF NOT EXISTS idx_message_broadcast_dept ON message_broadcast_groups(department_id);
CREATE INDEX IF NOT EXISTS idx_message_broadcast_role ON message_broadcast_groups(role_id);
