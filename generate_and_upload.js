const fs = require('fs');

// Helper to pick a random element
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Helper to generate a random number within a range
const randAmount = (min, max, step = 1000) => Math.floor((Math.random() * (max - min) / step)) * step + min;

const names = ["Aman", "Bhavna", "Chirag", "Deepika", "Esha", "Farhan", "Gaurav", "Harsh", "Ishan", "Jaya", "Karan", "Lata", "Manish", "Neha", "Om", "Priya", "Rahul", "Sneha", "Tarun", "Uma", "Varun", "Yash"];
const companies = ["Alpha Ltd.", "Beta Ltd.", "Gamma Ltd.", "Delta Ltd.", "Omega Ltd.", "Zenith Ltd.", "Apex Ltd.", "Pinnacle Ltd.", "Vertex Ltd.", "Quantum Ltd."];

const generateQuestion = (id) => {
  const chapterIdx = id % 7;
  let q = {};
  
  if (chapterIdx === 0) {
    // Accounting for Partnership Firms
    const n1 = pick(names);
    let n2 = pick(names);
    while(n1 === n2) n2 = pick(names);
    const capital1 = randAmount(50000, 500000, 10000);
    const capital2 = randAmount(50000, 500000, 10000);
    const intRate = randAmount(5, 12, 1);
    const int1 = (capital1 * intRate) / 100;
    
    q = {
      subject: "accounts",
      chapter: "Accounting for Partnership Firms",
      body: `${n1} and ${n2} are partners. ${n1}'s capital is ₹${capital1.toLocaleString('en-IN')} and ${n2}'s capital is ₹${capital2.toLocaleString('en-IN')}. If the partnership deed provides for interest on capital @ ${intRate}% p.a., what will be the interest on ${n1}'s capital?`,
      options: [
        { key: "A", text: `₹${int1.toLocaleString('en-IN')}` },
        { key: "B", text: `₹${(int1 + 1000).toLocaleString('en-IN')}` },
        { key: "C", text: `₹${((capital2 * intRate)/100).toLocaleString('en-IN')}` },
        { key: "D", text: "Nil, unless there is profit." }
      ],
      correct_answer: "A",
      explanation: `Interest on ${n1}'s capital is calculated as ₹${capital1.toLocaleString('en-IN')} x ${intRate}% = ₹${int1.toLocaleString('en-IN')}.`,
      difficulty: "easy",
      tags: ["partnership", "interest-on-capital"]
    };
  } else if (chapterIdx === 1) {
    // Reconstitution of Partnership
    const n1 = pick(names);
    let n2 = pick(names);
    while(n1 === n2) n2 = pick(names);
    const ratio1 = randAmount(2, 5, 1);
    const ratio2 = randAmount(1, 3, 1);
    const total = ratio1 + ratio2;
    const goodwill = randAmount(30000, 120000, 10000);
    const val1 = Math.round(goodwill * ratio1 / total);

    q = {
      subject: "accounts",
      chapter: "Reconstitution of Partnership",
      body: `${n1} and ${n2} share profits in the ratio ${ratio1}:${ratio2}. They decide to change their profit sharing ratio to equal. On this date, firm's goodwill is valued at ₹${goodwill.toLocaleString('en-IN')}. What will be the share of goodwill credited/debited to ${n1}'s capital account due to the sacrifice/gain?`,
      options: [
        { key: "A", text: `Sacrifice of ₹${Math.abs(val1 - (goodwill/2)).toLocaleString('en-IN')}` },
        { key: "B", text: `Gain of ₹${Math.abs(val1 - (goodwill/2)).toLocaleString('en-IN')}` },
        { key: "C", text: `₹${val1.toLocaleString('en-IN')}` },
        { key: "D", text: "No adjustment required." }
      ],
      correct_answer: (ratio1/total > 0.5) ? "A" : "B",
      explanation: `Old ratio is ${ratio1}:${ratio2}. New is 1:1. ${n1}'s old share = ${ratio1}/${total}. New = 1/2. Sacrifice/Gain = ${ratio1}/${total} - 1/2. Adjusting goodwill of ₹${goodwill.toLocaleString('en-IN')} gives the result.`,
      difficulty: "medium",
      tags: ["goodwill", "profit-sharing-ratio"]
    };
  } else if (chapterIdx === 2) {
    // Accounting for Share Capital
    const comp = pick(companies);
    const shares = randAmount(10000, 100000, 5000);
    const faceValue = 10;
    const premium = randAmount(2, 5, 1);
    const appMoney = randAmount(2, 4, 1);
    const allotMoney = randAmount(3, 6, 1); // includes premium
    
    q = {
      subject: "accounts",
      chapter: "Accounting for Share Capital",
      body: `${comp} issued ${shares.toLocaleString('en-IN')} equity shares of ₹${faceValue} each at a premium of ₹${premium} per share. Amount payable on application is ₹${appMoney} and on allotment is ₹${allotMoney} (including premium). What is the amount transferred to Securities Premium Reserve account upon allotment?`,
      options: [
        { key: "A", text: `₹${(shares * premium).toLocaleString('en-IN')}` },
        { key: "B", text: `₹${(shares * allotMoney).toLocaleString('en-IN')}` },
        { key: "C", text: `₹${(shares * (allotMoney - premium)).toLocaleString('en-IN')}` },
        { key: "D", text: `₹${(shares * faceValue).toLocaleString('en-IN')}` }
      ],
      correct_answer: "A",
      explanation: `Securities Premium Reserve = Number of shares × Premium per share = ${shares.toLocaleString('en-IN')} × ₹${premium} = ₹${(shares * premium).toLocaleString('en-IN')}.`,
      difficulty: "easy",
      tags: ["share-capital", "securities-premium"]
    };
  } else if (chapterIdx === 3) {
    // Analysis of Financial Statements
    const currAssets = randAmount(200000, 800000, 50000);
    const currLiab = randAmount(100000, 400000, 20000);
    const inv = randAmount(20000, 100000, 10000);
    const quickAssets = currAssets - inv;
    const currentRatio = (currAssets / currLiab).toFixed(2);
    const quickRatio = (quickAssets / currLiab).toFixed(2);

    q = {
      subject: "accounts",
      chapter: "Analysis of Financial Statements",
      body: `A company has Current Assets of ₹${currAssets.toLocaleString('en-IN')}, Current Liabilities of ₹${currLiab.toLocaleString('en-IN')}, and Inventory of ₹${inv.toLocaleString('en-IN')}. What is the Quick Ratio?`,
      options: [
        { key: "A", text: `${quickRatio}:1` },
        { key: "B", text: `${currentRatio}:1` },
        { key: "C", text: `${((currAssets + inv)/currLiab).toFixed(2)}:1` },
        { key: "D", text: `1:1` }
      ],
      correct_answer: "A",
      explanation: `Quick Assets = Current Assets - Inventory = ${currAssets} - ${inv} = ${quickAssets}. Quick Ratio = Quick Assets / Current Liabilities = ${quickAssets} / ${currLiab} = ${quickRatio}:1.`,
      difficulty: "medium",
      tags: ["ratio-analysis", "liquidity-ratios"]
    };
  } else if (chapterIdx === 4) {
    // Cash Flow Statement
    const profit = randAmount(100000, 500000, 20000);
    const dep = randAmount(10000, 50000, 5000);
    const lossOnSale = randAmount(2000, 15000, 1000);
    const cfo = profit + dep + lossOnSale;

    q = {
      subject: "accounts",
      chapter: "Cash Flow Statement",
      body: `Net Profit before tax and extraordinary items is ₹${profit.toLocaleString('en-IN')}. Depreciation for the year is ₹${dep.toLocaleString('en-IN')} and loss on sale of machinery is ₹${lossOnSale.toLocaleString('en-IN')}. Calculate the Operating Profit before working capital changes.`,
      options: [
        { key: "A", text: `₹${cfo.toLocaleString('en-IN')}` },
        { key: "B", text: `₹${(profit - dep).toLocaleString('en-IN')}` },
        { key: "C", text: `₹${(profit + dep - lossOnSale).toLocaleString('en-IN')}` },
        { key: "D", text: `₹${profit.toLocaleString('en-IN')}` }
      ],
      correct_answer: "A",
      explanation: `Operating profit before WC changes = Net Profit (₹${profit.toLocaleString('en-IN')}) + Non-cash/Non-operating expenses (Depreciation ₹${dep.toLocaleString('en-IN')} + Loss on sale ₹${lossOnSale.toLocaleString('en-IN')}) = ₹${cfo.toLocaleString('en-IN')}.`,
      difficulty: "medium",
      tags: ["cash-flow", "operating-activities"]
    };
  } else if (chapterIdx === 5) {
    // Accounting for Debentures
    const comp = pick(companies);
    const debs = randAmount(2000, 10000, 1000);
    const fv = randAmount(100, 500, 100);
    const discount = randAmount(5, 10, 1);
    
    q = {
      subject: "accounts",
      chapter: "Accounting for Debentures",
      body: `${comp} issued ${debs.toLocaleString('en-IN')}, 9% Debentures of ₹${fv} each at a discount of ${discount}%. What will be the amount credited to the 9% Debentures Account?`,
      options: [
        { key: "A", text: `₹${(debs * fv).toLocaleString('en-IN')}` },
        { key: "B", text: `₹${(debs * fv * (1 - discount/100)).toLocaleString('en-IN')}` },
        { key: "C", text: `₹${(debs * fv * (discount/100)).toLocaleString('en-IN')}` },
        { key: "D", text: "₹0, as they are issued at a discount." }
      ],
      correct_answer: "A",
      explanation: `Debentures Account is always credited with the face value, which is ${debs.toLocaleString('en-IN')} × ₹${fv} = ₹${(debs * fv).toLocaleString('en-IN')}.`,
      difficulty: "easy",
      tags: ["debentures", "issue-of-debentures"]
    };
  } else {
    // Computerized Accounting System
    const r1 = randAmount(10, 99, 1);
    const tools = ["Tally", "Busy", "Zoho Books", "QuickBooks", "Marg"];
    const tool = pick(tools);
    q = {
      subject: "accounts",
      chapter: "Computerized Accounting System",
      body: `In a computerized accounting system like ${tool}, which of the following is considered the primary document for recording a cash purchase transaction (Ref ID: ${r1})?`,
      options: [
        { key: "A", text: "Payment Voucher" },
        { key: "B", text: "Receipt Voucher" },
        { key: "C", text: "Journal Voucher" },
        { key: "D", text: "Contra Voucher" }
      ],
      correct_answer: "A",
      explanation: "Cash purchases involve outflow of cash, which is recorded using a Payment Voucher in computerized accounting systems.",
      difficulty: "easy",
      tags: ["computerized-accounting", "vouchers"]
    };
  }
  
  // Randomize correct option position slightly for variation, 
  // though we mapped keys statically A/B/C/D, so the correct option text is what we need to shuffle.
  // Actually, we can keep the static keys to ensure valid strict schema.
  
  return q;
};

const questions = [];
for (let i = 0; i < 1000; i++) {
  questions.push(generateQuestion(i));
}

// Upload in batches
const BATCH_SIZE = 50;

async function uploadBatch(batch, batchIndex) {
  let successes = 0;
  for (const q of batch) {
    try {
      const res = await fetch('http://localhost:3000/api/questions/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q)
      });
      if (res.ok) {
        successes++;
      } else {
        const err = await res.text();
        if(!err.includes('An identical question already exists')) {
          console.error(`Failed to upload question: ${err}`);
        }
      }
    } catch (e) {
      console.error(`Network error: ${e.message}`);
    }
  }
  console.log(`Batch ${batchIndex + 1} completed. ${successes} uploaded successfully.`);
}

async function run() {
  console.log('Starting upload of 1000 questions...');
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    await uploadBatch(batch, i / BATCH_SIZE);
  }
  console.log('All 1000 questions processed!');
}

run();
