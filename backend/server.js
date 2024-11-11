const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8000;

// assuming max level (100 in DT)
const BASE_GCD_MS = 2500;
const BASE_SKS = 420;
const LVL_MULTI = 2780;

// middleware
app.use(cors());
app.use(bodyParser.json());

// connecting to mongodb atlas
mongoose.connect('mongodb+srv://abhole:trees@ffxiv-gcd-calc.b6yeu.mongodb.net/?retryWrites=true&w=majority&appName=ffxiv-gcd-calc', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// schema
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
        type: String, // may need to be number...
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

const character = mongoose.model('character', characterSchema, 'characters');

// routes
app.post('/calculate', async (req, res) => {
    const { gcd } = req.body;

    try {
        console.log("Calculating...")
        const skillspeed = calculateSkillspeed(gcd); 
        const otherGCDs = calculateOtherGCDs(gcd);
        result = {
            gcd,
            skillspeed,
            otherGCDs,
        };
        res.json(result);
        console.log("Done.")
    } catch (error) {
        console.error("Error: ", error); 
        res.status(500).json({ message: error.message });
    }
});

app.post('/search', async (req, res) => {
    const {lodestoneID} = req.body;

    try {
        let result = await character.findOne({ lodestoneId: lodestoneID })

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

// derived sks calculation based on AkhMorning's formulae
function calculateSkillspeed(targetGCD) {
    for (let speed = 0; speed <= 4000; speed++) {
        const calculatedResult = (BASE_GCD_MS * (1000 + Math.ceil(130 * (BASE_SKS - speed) / LVL_MULTI)) / 10000);
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
    const result = ((otherCGD * 1000) * (1000 + Math.ceil(130 * (BASE_SKS - speed) / LVL_MULTI)) / 10000)
    const resultGCD = Math.floor(result) / 100
    
    return resultGCD;
}

// scraping
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cheerio = require('cheerio');

// fetch and parse HTML util
async function fetchPage(url) {
  try {
    const response = await fetch(url);
    const body = await response.text();
    return cheerio.load(body); // parsing HTML with cheerio
  } catch (error) {
    console.error('Error fetching page:', error);
    throw error;
  }
}

// scrape character details
async function scrapeCharacter(lodestoneId) {
    const url = `http://na.finalfantasyxiv.com/lodestone/character/${lodestoneId}/`;
    const $ = await fetchPage(url);
  
    const name = $('p.frame__chara__name').text().trim();
  
    const avatarUrl = $('div.character__detail__image img').attr('src');
    const portraitUrl = $('div.frame__chara__face img').attr('src');
  
    const stats = {};
    const paramBlocks = $('.character__param__list');
  
    paramBlocks.each((_, paramBlock) => {
        const statNames = $(paramBlock).find('span');
        
        statNames.each((_, statNameTh) => {
            const statName = $(statNameTh).text().trim();
            const statVal = $(statNameTh).parent().next().text().trim();
  
            // convert to float if statVal is numeric
            if (!isNaN(statVal)) {
                // normalize stat names to match schema (e.g., 'Skill Speed' to 'skillSpeed')
                const normalizedStatName = statName.replace(/\s+/g, '').toLowerCase();
                stats[normalizedStatName] = parseFloat(statVal);
            }
        });
    });
  
    ['hp', 'mp'].forEach(attr => {
      const value = $(`p.character__param__text__${attr}--en-us`).next().text();
      if (value) {
        stats[attr.toUpperCase()] = parseInt(value, 10);
      }
    });
  
    const equipment = [];
    $('.ic_reflection_box').each((i, elem) => {
      const slot = $(elem).find('p.db-tooltip__item__category').text();
      const itemName = $(elem).find('h2.db-tooltip__item__name').text();
      const itemImage = $(elem).find('img.db-tooltip__item__icon__item_image').attr('src');
      if (slot && itemName && itemImage) {
        equipment.push({ slot, name: itemName, image: itemImage });
      }
    });
  
    return {
        lodestoneId,
        name,
        avatarUrl,
        portraitUrl,
        stats,
        equipment
    };
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

