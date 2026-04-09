import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv('../.env')

db = mysql.connector.connect(
    host=os.getenv('MYSQL_HOST'),
    port=int(os.getenv('MYSQL_PORT')),
    user=os.getenv('MYSQL_USER'),
    password=os.getenv('MYSQL_PASSWORD'),
    database=os.getenv('MYSQL_DATABASE')
)

cursor = db.cursor()

columns_to_add = [
    ('entraId', 'VARCHAR(255)'),
    ('googleAuthenticated', 'BOOLEAN DEFAULT FALSE'),
    ('microsoftAuthenticated', 'BOOLEAN DEFAULT FALSE'),
    ('lastLogin', 'DATETIME'),
    ('loginStatus', 'ENUM("ONLINE", "OFFLINE") DEFAULT "OFFLINE"')
]

for col_name, col_type in columns_to_add:
    cursor.execute(f'SHOW COLUMNS FROM users LIKE "{col_name}"')
    result = cursor.fetchone()
    if not result:
        print(f'Adding column: {col_name}')
        cursor.execute(f'ALTER TABLE users ADD COLUMN {col_name} {col_type}')
        db.commit()
    else:
        print(f'Column {col_name} already exists')

print('Done!')
cursor.close()
db.close()
