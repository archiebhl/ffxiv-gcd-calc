// server with GCD server shenanigans

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8000;

// middleware
app.use(cors());
app.use(bodyParser.json());

// connecting to mongodb atlas
mongoose.connect('mongodb+srv://abhole:trees@ffxiv-gcd-calc.b6yeu.mongodb.net/?retryWrites=true&w=majority&appName=ffxiv-gcd-calc', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// schema
const gcdSchema = new mongoose.Schema({
    gcd: Number,
    skillspeed: Number,
    otherGCDs: Object,
});

const equipmentSchema = new mongoose.Schema({
    slot: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    }
}, { _id: false });

const characterSchema = new mongoose.Schema({
    /*lodestoneId: {
        type: String,
        unique: true
    },*/
    lodestoneId: String,
    name: String,
    avatarUrl: String,
    portraitUrl: String,
    stats: {
        strength: Number,
        dexterity: Number,
        vitality: Number,
        intelligence: Number,
        mind: Number,
        criticalhitrate: Number,
        determination: Number,
        directhitrate: Number,
        defense: Number,
        magicdefense: Number,
        attackpower: Number,
        skillspeed: Number,
        attackmagicpotency: Number,
        healingmagicpotency: Number,
        spellspeed: Number,
        tenacity: Number,
        piety: Number,
        hp: Number,
        mp: Number
    },
    equipment: [equipmentSchema]
});

const GCD = mongoose.model('GCD', gcdSchema, 'gcds');
const character = mongoose.model('character', characterSchema, 'characters');

// routes
app.post('/calculate', async (req, res) => {
    const { gcd } = req.body;

    try {
        let result = await GCD.findOne({ gcd });

        if (!result) {
            console.log(`GCD not found, calculating...`);
            // get skillspeed and other GCDs based on input gcd
            const skillspeed = calculateSkillspeed(gcd); 
            const otherGCDs = calculateOtherGCDs(gcd);

            // create new record
            result = await GCD.create({ gcd, skillspeed, otherGCDs });
            console.log(`Inserted new GCD:`, result);
        } else {
            console.log(`GCD found:`, result);
        }

        res.json(result);
    } catch (error) {
        console.error("Error: ", error); 
        res.status(500).json({ message: error.message });
    }
});

app.post('/search', async (req, res) => {
    const {lodestoneID} = req.body;

    try {
        let result = await character.findOne({ lodestoneID })

        if (!result) {
            console.log("Character not found, scraping...")
            const searchedCharacter = await scrapeCharacter(lodestoneID);
            result = await character.create(searchedCharacter);
            console.log("Inserted new character: ", searchedCharacter);
        } else {
            console.log("Character found: ", result);
        }

        res.json(result);
    } catch (error) {
        console.error("Error: ", error);
        res.status(500).json({ message: error.message });
    }
});

// derived sks formula based on AkhMorning's formulae
function calculateSkillspeed(targetGCD) {
    
    for (let speed = 0; speed <= 4000; speed++) {
        const calculatedResult = (2500 * (1000 + Math.ceil(130 * (420 - speed) / 2780)) / 10000);
        if (Math.floor(calculatedResult) / 100 === targetGCD) {
            return speed;
        }
    }
    return null;
}

// calculating sks impact on other gcds
function calculateOtherGCDs(inputCGD) {
    const gcdValues = [1.5, 2.0, 2.5, 2.8, 3.0, 3.5, 4.0, 30, 60];
    const results = {};
    
    for (let value of gcdValues) {
        results[value] = calculateGCD(inputCGD, value);
    }
    return results;
}

// from AkhMorning's formula
function calculateGCD(inputGCD, otherCGD) {
    const speed = calculateSkillspeed(inputGCD);
    const result = ((otherCGD * 1000) * (1000 + Math.ceil(130 * (420 - speed) / 2780)) / 10000)
    const resultGCD = Math.floor(result) / 100
    
    return resultGCD;
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    scrapeCharacter('36834385').then(character => {
        console.log('Character Details:', character);
    }).catch(err => {
        console.error('Error:', err);
    });
});

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cheerio = require('cheerio');

// Utility to fetch and parse HTML
async function fetchPage(url) {
  try {
    const response = await fetch(url);
    const body = await response.text();
    return cheerio.load(body); // Parse HTML with cheerio
  } catch (error) {
    console.error('Error fetching page:', error);
    throw error;
  }
}

// Function to scrape character details
async function scrapeCharacter(lodestoneId) {
    const url = `http://na.finalfantasyxiv.com/lodestone/character/${lodestoneId}/`;
    const $ = await fetchPage(url);
  
    // Scrape character name
    const name = $('p.frame__chara__name').text().trim();
  
    // Scrape character image (avatar and portrait)
    const avatarUrl = $('div.character__detail__image img').attr('src');
    const portraitUrl = $('div.frame__chara__face img').attr('src');
  
    // Scrape character stats
    const stats = {};
    const paramBlocks = $('.character__param__list');
  
    paramBlocks.each((_, paramBlock) => {
        const statNames = $(paramBlock).find('span');
        
        statNames.each((_, statNameTh) => {
            const statName = $(statNameTh).text().trim();
            const statVal = $(statNameTh).parent().next().text().trim();
  
            // Convert to float if statVal is numeric
            if (!isNaN(statVal)) {
                // Normalize stat names to match schema (e.g., 'Skill Speed' to 'skillSpeed')
                const normalizedStatName = statName.replace(/\s+/g, '').toLowerCase();
                stats[normalizedStatName] = parseFloat(statVal);
            }
        });
    });
  
    // Scrape HP, MP stats
    ['hp', 'mp'].forEach(attr => {
      const value = $(`p.character__param__text__${attr}--en-us`).next().text();
      if (value) {
        stats[attr.toUpperCase()] = parseInt(value, 10);
      }
    });
  
    // Scrape equipment
    const equipment = [];
    $('.ic_reflection_box').each((i, elem) => {
      const slot = $(elem).find('p.db-tooltip__item__category').text();
      const itemName = $(elem).find('h2.db-tooltip__item__name').text();
      const itemImage = $(elem).find('img.db-tooltip__item__icon__item_image').attr('src');
      if (slot && itemName && itemImage) {
        equipment.push({ slot, name: itemName, image: itemImage });
      }
    });
  
    // Return a well-structured character object
    return {
        lodestoneId,
        name,
        avatarUrl,
        portraitUrl,
        stats,
        equipment
    };
  }  

