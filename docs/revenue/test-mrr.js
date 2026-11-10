const {subscriptionMrr}=require('./mrr');
const {classify}=require('./engine');
const plans=new Map([['p1',{countsInMrr:true}],['ga',{countsInMrr:false}]]);
const fx=new Map();
const sub={status:'active',currency:'usd',items:[{priceId:'p1',unitAmount:30000,quantity:1,interval:'month',intervalCount:1},{priceId:'ga',unitAmount:18000,quantity:1,interval:'month',intervalCount:1}],discount:{percentOff:10}};
console.log(subscriptionMrr(sub,plans,fx)); // 270
console.log(subscriptionMrr({...sub,items:[{priceId:'p1',unitAmount:120000,quantity:1,interval:'year',intervalCount:1}],discount:null},plans,fx)); //100
console.log(subscriptionMrr({...sub,status:'canceled'},plans,fx)); //0
console.log(classify(0,100,false),classify(0,100,true),classify(100,0,true),classify(100,150,true),classify(150,100,true));
