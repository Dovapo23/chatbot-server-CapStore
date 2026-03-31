'use strict';

const path = require('path');

const IMG = path.resolve(__dirname, '..', 'images');
const PRICE = 65000;

// Para cambiar el nombre de una gorra, edita el campo "name" aquí.
const collections = {
  agropecuario: {
    nombre: 'Colección 100% Agropecuario 2026',
    emoji: '🌾',
    products: [
      { id: 'agro-1', name: 'Agropecuario Negro Clásico',    image: path.join(IMG, 'agropecuario', 'agropecuario-negro-clasico.jpeg'),    price: PRICE },
      { id: 'agro-2', name: 'Agropecuario Gris',             image: path.join(IMG, 'agropecuario', 'agropecuario-gris.jpeg'),             price: PRICE },
      { id: 'agro-3', name: 'Agropecuario Camel Suede',      image: path.join(IMG, 'agropecuario', 'agropecuario-camel-suede.jpeg'),      price: PRICE },
      { id: 'agro-4', name: 'Agropecuario Negro Neon Rojo',  image: path.join(IMG, 'agropecuario', 'agropecuario-negro-neon-rojo.jpeg'),  price: PRICE },
      { id: 'agro-5', name: 'Agropecuario Rosa Suede',       image: path.join(IMG, 'agropecuario', 'agropecuario-rosa-suede.jpeg'),       price: PRICE },
      { id: 'agro-6', name: 'Agropecuario Borgoña y Negro',  image: path.join(IMG, 'agropecuario', 'agropecuario-borgona-negro.jpeg'),    price: PRICE },
      { id: 'agro-7', name: 'Agropecuario Negro Total Suede',image: path.join(IMG, 'agropecuario', 'agropecuario-negro-total-suede.jpeg'),price: PRICE },
    ]
  },

  colombia: {
    nombre: 'República de Colombia',
    emoji: '🇨🇴',
    products: [
      { id: 'col-1',  name: 'República de Colombia Negra',           image: path.join(IMG, 'colombia', 'colombia-negra.jpeg'),            price: PRICE },
      { id: 'col-2',  name: 'República de Colombia Roja',            image: path.join(IMG, 'colombia', 'colombia-roja.jpeg'),             price: PRICE },
      { id: 'col-3',  name: 'República de Colombia Edición Especial',image: path.join(IMG, 'colombia', 'colombia-edicion-especial.jpeg'), price: PRICE },
      { id: 'col-4',  name: 'República de Colombia Clásica',         image: path.join(IMG, 'colombia', 'colombia-clasica.jpeg'),          price: PRICE },
      { id: 'col-5',  name: 'Colombia Café Escudo',                  image: path.join(IMG, 'colombia', 'colombia-cafe-escudo.jpeg'),      price: PRICE },
      { id: 'col-6',  name: 'República de Colombia Blanca',          image: path.join(IMG, 'colombia', 'colombia-blanca.jpeg'),           price: PRICE },
      { id: 'col-7',  name: 'Colombia Blanca Bordada',               image: path.join(IMG, 'colombia', 'colombia-blanca-bordada.jpeg'),   price: PRICE },
      { id: 'col-8',  name: 'Colombia Tricolor Especial',            image: path.join(IMG, 'colombia', 'colombia-tricolor-especial.jpeg'),price: PRICE },
      { id: 'col-9',  name: 'Colombia Premium Dorada',               image: path.join(IMG, 'colombia', 'colombia-premium-dorada.jpeg'),   price: PRICE },
      { id: 'col-10', name: 'República de Colombia Verde Militar',   image: path.join(IMG, 'colombia', 'colombia-verde-militar.jpeg'),    price: PRICE },
      { id: 'col-11', name: 'Colombia Edición Limitada',             image: path.join(IMG, 'colombia', 'colombia-edicion-limitada.jpeg'), price: PRICE },
    ]
  },

  luxury: {
    nombre: 'New Era Colección Luxury',
    emoji: '💎',
    products: [
      { id: 'lux-1',  name: 'Anaheim Ducks 30th Anniversary',    image: path.join(IMG, 'luxury', 'luxury-anaheim-ducks-30th.jpeg'),           price: PRICE },
      { id: 'lux-2',  name: 'LA Dodgers 60th Anniversary',       image: path.join(IMG, 'luxury', 'luxury-dodgers-60th.jpeg'),                 price: PRICE },
      { id: 'lux-3',  name: 'LA Dodgers Roses Edition',          image: path.join(IMG, 'luxury', 'luxury-dodgers-roses.jpeg'),                price: PRICE },
      { id: 'lux-4',  name: 'NY Yankees 1999 World Series',      image: path.join(IMG, 'luxury', 'luxury-yankees-1999-world-series.jpeg'),    price: PRICE },
      { id: 'lux-5',  name: 'Mets Crema Verde',                  image: path.join(IMG, 'luxury', 'luxury-mets-crema-verde.jpeg'),             price: PRICE },
      { id: 'lux-6',  name: 'Yankees Negra Llamas',              image: path.join(IMG, 'luxury', 'luxury-yankees-negra-llamas.jpeg'),         price: PRICE },
      { id: 'lux-7',  name: 'Yankees Azul Celeste',              image: path.join(IMG, 'luxury', 'luxury-yankees-azul-celeste.jpeg'),         price: PRICE },
      { id: 'lux-8',  name: 'Red Sox Negra Rosas',               image: path.join(IMG, 'luxury', 'luxury-red-sox-negra-rosas.jpeg'),          price: PRICE },
      { id: 'lux-9',  name: 'White Sox Camel',                   image: path.join(IMG, 'luxury', 'luxury-white-sox-camel.jpeg'),              price: PRICE },
      { id: 'lux-10', name: 'Yankees Negra Clásica',             image: path.join(IMG, 'luxury', 'luxury-yankees-negra-clasica.jpeg'),        price: PRICE },
      { id: 'lux-11', name: 'Mighty Ducks Crema',                image: path.join(IMG, 'luxury', 'luxury-mighty-ducks-crema.jpeg'),           price: PRICE },
      { id: 'lux-12', name: 'Yankees Gris New York',             image: path.join(IMG, 'luxury', 'luxury-yankees-gris-new-york.jpeg'),        price: PRICE },
      { id: 'lux-13', name: 'Giants Camel',                      image: path.join(IMG, 'luxury', 'luxury-giants-camel.jpeg'),                 price: PRICE },
      { id: 'lux-14', name: 'White Sox Negra',                   image: path.join(IMG, 'luxury', 'luxury-white-sox-negra.jpeg'),              price: PRICE },
      { id: 'lux-15', name: 'Red Sox Negra',                     image: path.join(IMG, 'luxury', 'luxury-red-sox-negra.jpeg'),                price: PRICE },
      { id: 'lux-16', name: 'Yankees Negra USA',                 image: path.join(IMG, 'luxury', 'luxury-yankees-negra-usa.jpeg'),            price: PRICE },
      { id: 'lux-17', name: 'Dodgers Negra Los Angeles',         image: path.join(IMG, 'luxury', 'luxury-dodgers-negra-los-angeles.jpeg'),    price: PRICE },
      { id: 'lux-18', name: 'Oakland A\'s Verde',                image: path.join(IMG, 'luxury', 'luxury-oakland-as-verde.jpeg'),             price: PRICE },
      { id: 'lux-19', name: 'Charlotte Hornets Gris',            image: path.join(IMG, 'luxury', 'luxury-charlotte-hornets-gris.jpeg'),       price: PRICE },
      { id: 'lux-20', name: 'Dodgers Roja World Series',         image: path.join(IMG, 'luxury', 'luxury-dodgers-roja-world-series.jpeg'),    price: PRICE },
      { id: 'lux-21', name: 'Dodgers Roja Viva Los Dodgers',     image: path.join(IMG, 'luxury', 'luxury-dodgers-roja-viva-los-dodgers.jpeg'),price: PRICE },
      { id: 'lux-22', name: 'Angels Negra World Champions',      image: path.join(IMG, 'luxury', 'luxury-angels-negra-world-champions.jpeg'), price: PRICE },
      { id: 'lux-23', name: 'Oakland A\'s World Series',         image: path.join(IMG, 'luxury', 'luxury-oakland-as-world-series.jpeg'),      price: PRICE },
      { id: 'lux-24', name: 'Red Sox Negra Llamas',              image: path.join(IMG, 'luxury', 'luxury-red-sox-negra-llamas.jpeg'),         price: PRICE },
      { id: 'lux-25', name: 'Dodgers Negra Cupido',              image: path.join(IMG, 'luxury', 'luxury-dodgers-negra-cupido.jpeg'),         price: PRICE },
      { id: 'lux-26', name: 'Yankees Crema Rosas',               image: path.join(IMG, 'luxury', 'luxury-yankees-crema-rosas.jpeg'),          price: PRICE },
    ]
  }
};

module.exports = { collections };
