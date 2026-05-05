fetch("http://localhost:3000/api/discounts").then(r => r.text()).then(t => console.log(t.substring(0,500)));
