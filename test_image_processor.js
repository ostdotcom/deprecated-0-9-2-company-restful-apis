
// USAGE : refer to : https://www.npmjs.com/package/jimp

const Jimp = require("jimp");

const imageFileName = '/Users/PpuneetKhushwani/Desktop/828544_p.jpg';
const foneFileName = Jimp.FONT_SANS_32_WHITE;

var outputFileName = '/Users/PpuneetKhushwani/Desktop/828544_p_1.jpg';

var imageCaption = 'FPC';

var rawImage = null;
var fontFile = null;

function readFromFile() {
  return Jimp.read(imageFileName).then(function(image){
    console.log('image loaded');
    rawImage = image;
    return Promise.resolve({});
  });
}

function loadFontFile() {
  return Jimp.loadFont(foneFileName).then(function(font){
    console.log('font file loaded');
    fontFile = font;
    return Promise.resolve({});
  });
}

function modifyImage() {

  var printCb = function() {
    console.log('test written to image');
    rawImage.write(outputFileName, writeCb);
  };

  var writeCb = function() {
    console.log('image written to file');
    return Promise.resolve({});
  };

  return rawImage.print(fontFile, 200, 200, imageCaption, printCb);

}

readFromFile()
    .then( loadFontFile )
    .then( modifyImage )
    .catch(function(e){
      console.error(e);
    });
