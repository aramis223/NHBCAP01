const http = require('http');

const customers = [
    {
        customerId: 'T001',
        name: 'Temenos Customer One',
        customerType: 'Corporate'
    },
    {
        customerId: 'T002',
        name: 'Temenos Customer Two',
        customerType: 'Individual'
    }
];

const server = http.createServer((req, res) => {
    if (req.url === '/customers' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(customers));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(5000, () => {
    console.log('Mock Temenos API running on http://localhost:5000');
});
