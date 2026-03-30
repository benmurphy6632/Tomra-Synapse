CREATE TABLE IF NOT EXISTS feedback_votes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(255),
    result_id BIGINT,
    vote VARCHAR(10),
    model VARCHAR(255),
    image_name VARCHAR(255),
    device_id VARCHAR(255),
    image_url VARCHAR(1000),
    CONSTRAINT uq_vote UNIQUE (project_id, result_id)
);