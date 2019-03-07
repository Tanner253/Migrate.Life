'use strict';

//App depends
const express = require('express');
const superagent = require ('superagent');
const pg = require('pg');
const methodOverride = require('method-override');
const PORT = process.env.PORT || 3000;
require('dotenv').config();

//express app creation
const app = express();
app.use(express.urlencoded({extended:true}));

//EJS declaration
app.set('view engine', 'ejs');
app.use(express.static('./public'));

app.get('/', (request, response) => response.render('index'))


app.get('/search/:region', renderFunction);


//Helper functions

function getRegion(coord){
  if(coord === 'north') {
    return {left:'-111.437624', bottom:'39.548000', right:'-84.919028', top:'48.473604', zoom:'5'}
  } else if(coord === 'east') {
    return {left:'-84.919028', bottom:'25.891349', right:'-68.528937', top:'42.368691', zoom:'5'}
  } else if(coord === 'west') {
    return {left:'-125.669681', bottom:'32.120673', right:'-111.437624', top:'48.473604', zoom:'5'}
  } else if(coord === 'south') {
    return {left:'-111.437624', bottom:'29.416872', right:'-84.919028', top:'39.548000', zoom:'4'}
  }else{
    return false;
  }
}

async function getCities(regionBox) {

  let url = `http://api.openweathermap.org/data/2.5/box/city?bbox=${regionBox.left},${regionBox.bottom},${regionBox.right},${regionBox.top},${regionBox.zoom}&APPID=${process.env.OPEN_WEATHER_API_KEY}`

  let placesIdk = [];

  await superagent.get(url)
    .then(results => {
      results.body.list.forEach(data => placesIdk.push(new Places(data)))
      // console.log(placesIdk)
    })
    .catch(console.log('this is an error'))
  
  return placesIdk;
}

function priceUrl(city) {
  const url = `https://www.numbeo.com/api/city_prices?api_key=${process.env.NUMBEO_API_KEY}&query=${city.name}`;
  
  return superagent.get(url)
}

function qualityUrl(city){
  const url = `https://www.numbeo.com/api/indices?api_key=${process.env.NUMBEO_API_KEY}&query=${city.name}`
  
  return superagent.get(url)
}

function rangeIdentifier(obj) {
  console.log(obj);
  if(parseInt(obj.temp) >= 85){
    return 'Hot';
  } else if(parseInt(obj.temp) >= 65){
    return 'Warm';
  } else if (parseInt(obj.temp) >= 40){
    return 'Cool';
  } else {
    return 'Cold';
  }
}

function renderFunction(request, response) {
  let prices = [];
  let quality = [];

  let region = getRegion(request.params.region);
  getCities(region)
    .then(cities => {
      // console.log(cities);
      let getPrices = cities.map(city => priceUrl(city));
      let getQuality = cities.map(city => qualityUrl(city));

      Promise.all(getPrices)
        .then(values => {
          values.forEach(data => {
            prices.push(new Prices(data.body))
          });
         
          Promise.all(getQuality)
          .then(value => {
            value.forEach(data => {
              quality.push(new Quality(data.body))
            });
            
            let cityData = [];
            let climateData = [];
            cities.forEach(cityData => climateData.push(rangeIdentifier(cityData)))
            for(let i = 0; i < cities.length; i++){
              cityData.push(new CityData(cities[i],prices[i],quality[i],climateData[i]))
            }
            response.render('pages/searches', {cities:cityData})
          })

        })
        .catch(error => console.log(error))

      // .then(array => console.log('Line 97', array));
      
  })
}


//-------------------------------//
//-----CONSTRUCTOR FUNCTIONS-----//
//-------------------------------//

function Places(data) {
  this.name = data.name;
  this.latitude = data.coord.Lat;
  this.longitude = data.coord.Lon;
  this.temp = data.main.temp ? (data.main.temp*(9/5)+32) : 'n-a';
}

function Prices(data) {
  this.milk = data.prices[7].average_price;
  this.beer = data.prices[13].average_price;
  this.gas = data.prices[19].average_price;
  this.internet = data.prices[27].average_price;
}

function Quality(data){
  this.health = data.health_care_index.toFixed(1);
  this.property = data.property_price_to_income_ratio.toFixed(1);
  this.climate = data.climate_index.toFixed(1);
}

function CityData(place, price, quality, climateRange){
  this.name = place.name;
  this.latitude = place.latitude;
  this.longitude = place.longitude;
  this.temp = place.temp;

  this.milk = (price.milk * 3.7854).toFixed(2);
  this.beer = (price.beer * 2.113).toFixed(2);
  this.gas = (price.gas * 3.785).toFixed(2);;
  this.internet = price.internet.toFixed(2);;

  this.health = quality.health;
  this.property = quality.property;
  this.climate = quality.climate;
  this.climateRange = climateRange;

}

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
