const pdf = require('pdf-parse');
const fs = require('fs');
const data = fs.readFileSync('C:\\Users\\ADMIN\\Downloads\\students.pdf');
pdf(data).then(function(result) {
    console.log(result.text);
});