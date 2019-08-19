const bel = require("bel")
const csjs = require("csjs-inject")
const ethers = require('ethers')
const glossary = require('glossary')
const loadingAnimation = require('loadingAnimation')
const makeDeployReceipt = require('makeDeployReceipt')
const getArgs = require('getArgs')
const makeReturn = require('makeReturn')
const shortenHexData = require('shortenHexData')
const inputAddress = require("input-address")
const inputArray = require("input-array")
const inputInteger = require("input-integer")
const inputBoolean = require("input-boolean")
const inputString = require("input-string")
const inputByte = require("input-byte")
const inputPayable = require("input-payable")
const copy = require('copy-text-to-clipboard')
const theme = require('theme')
var colors = setTheme('darkTheme')
// Styling variables

var css
var fonts = [ "https://use.fontawesome.com/releases/v5.8.2/css/all.css",
  'https://fonts.googleapis.com/css?family=Nunito&display=swap']
var fontAwesome = bel`<link href=${fonts[0]} rel='stylesheet' type='text/css'>`
var overpassMono = bel`<link href=${fonts[1]} rel='stylesheet' type='text/css'>`
var viewPort = bel`<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">`
document.head.appendChild(viewPort)
document.head.appendChild(fontAwesome)
document.head.appendChild(overpassMono)

// ===== Switch Themes =====
function themeSwitch() {
  return bel`
  <section class=${css.themeSwitch}>
    <span class="${css.colorplate} ${css.cubeWhite}" onclick=${() => { colors = setTheme('lightTheme'); console.log(colors) }}></span>
    <span class="${css.colorplate} ${css.cubeDark}" onclick=${() => { colors = setTheme('darkTheme'); console.log(colors) }}></span>
  </section>
  `
}

function setTheme(name) {
  let colors = Object.assign({}, theme(name))
  return colors
}


/******************************************************************************
  ETHERS
******************************************************************************/

var provider
var contract

async function getProvider() {
  if (window.web3.currentProvider) {
    try {
      // Acccounts now exposed
      provider = new ethers.providers.Web3Provider(window.web3.currentProvider)
      // Request account access if needed
      await ethereum.enable();
    } catch (error) {
      console.log(error)
    }
  } else {
    window.open("https://metamask.io/")
  }
  return provider
}

/*--------------------
      PAGE
--------------------*/
module.exports = displayContractUI

function displayContractUI(result) {   // compilation result metadata
  var opts = {
    metadata: {
      compiler: { version: result[0].compiler.version },
      language: result[0].compiler.language,
      output: {
        abi: result[0].abi,
        devdoc: result[0].metadata.devdoc,
        userdoc: result[0].metadata.userdoc
      },
      bytecode: result[0].binary.bytecodes.bytecode,
      settings: {
        compilationTarget: { '': result[0].sources.compilationTarget },
        evmVersion: result[0].compiler.evmVersion,
        libraries: result[0].sources.libraries,
        optimizer: { enabled: result[0].compiler.optimizer, runs: result[0].compiler.runs },
        remapings: result[0].sources.remappings
      },
      sources: { '': result[0].sources.sourcecode }
    }
}
  if (!opts || !opts.metadata) {
    return  bel`
    <div class=${css.preview}>
      <div class=${css.error}>
        <div class=${css.errorTitle}>error <i class="${css.errorIcon} fa fa-exclamation-circle"></i></div>
        ${opts}
      </div>
    </div>
    `
  }

  if (!Array.isArray(opts.metadata)) {
    var solcMetadata = opts.metadata
    function getConstructorName() {
      var file = Object.keys(solcMetadata.settings.compilationTarget)[0]
      return solcMetadata.settings.compilationTarget[file]
    }

    function getConstructorInput() {
      var payable = false
      var inputs = solcMetadata.output.abi.map(fn => {
        if (fn.type === "constructor") {
          if (fn.stateMutability === 'payable') payable = true
          return treeForm(fn.inputs)
        }
      })
      if (payable === true) inputs.unshift(inputPayable('payable'))
      return inputs
    }

    function getContractFunctions() {
      return solcMetadata.output.abi.map(x => {
        var obj = {}
        obj.name = x.name
        obj.type = x.type
        obj.inputs = getAllInputs(x)
        obj.outputs = getAllOutputs(x)
        obj.stateMutability = x.stateMutability
        return obj
      })
    }

    function getAllInputs(fn) {
      var inputs = []
      if (fn.inputs) {
        return treeForm(fn.inputs)
      }
    }

    function getAllOutputs(fn) {
      var outputs = []
      if (fn.outputs) {
        return treeForm(fn.outputs)
      }
    }

    function treeForm(data) {
      return data.map(x => {
        if (x.components) {
          return bel`<li><div>${x.name} (${x.type})</div><ul>${treeForm(x.components)}</ul></li>`
        }
        if (!x.components) {
          return generateInputContainer(x)
        }
      })
    }

    var metadata = {
      compiler: solcMetadata.compiler.version,
      compilationTarget: solcMetadata.settings.compilationTarget,
      constructorName: getConstructorName(),
      constructorInput: getConstructorInput(),
      functions: getContractFunctions()
    }

    var sorted = sort(metadata.functions)
    function sort (functions) {
      return functions.filter(x => x.type === 'function').sort((a, b) => type2num(a) - type2num(b))
      function type2num ({ stateMutability: sm }) {
        if (sm === 'view') return 1
        if (sm === 'nonpayable') return 2
        if (sm === 'pure') return 3
        if (sm === 'payable') return 4
        if (sm === undefined) return 5
      }
    }

    function generateInputContainer (field) {
      var theme = { classes: css, colors}
      var name = field.name
      var type = field.type
      var inputField = getInputField( {theme, type, cb})
      var inputContainer = bel`
        <div class=${css.inputContainer}>
          <label class=${css.inputParam} title="data type: ${type}">${name || 'key'}</label>
          <div class=${css.inputFields}>${inputField}</div>
        </div>`
      return inputContainer
      function cb (msg, el, value) {
        var oldOutput = el.parentNode.querySelector("[class^='output']")
        var output = oldOutput ? oldOutput : output = bel`<span class=${css.output}></span>`
        output.innerHTML = ""
        output.innerHTML = msg ? `<span class=${css.valError} title="${msg}"><i class="fa fa-exclamation"></i></span>` : `<span class=${css.valSuccess} title="The value is valid."><i class="fa fa-check"></i></span>`
        el.parentNode.appendChild(output)
      }
    }

    function getInputField ({ theme, type, cb}) {
      var field
      if ((type.search(/\]/) != -1)) {
        var arrayInfo = type.split('[')[1]
        var digit = arrayInfo.search(/\d/)
        field = inputArray({ theme, type, cb })
      } else {
        if ((type.search(/\buint/) != -1) || (type.search(/\bint/) != -1)) field = inputInteger({ theme, type, cb })
        if (type.search(/\bbyte/) != -1) field = inputByte({ theme, type, cb })
        if (type.search(/\bstring/) != -1) field = inputString({ theme, type, cb })
        if (type.search(/\bfixed/) != -1) field = inputInteger({ theme, type, cb })
        if (type.search(/\bbool/) != -1) field = inputBoolean({ theme, type, cb })
        if (type.search(/\baddress/) != -1) field = inputAddress({ theme, type, cb })
      }
      return field
    }

    function functions (fn) {
      var label = fn.stateMutability
      var fnName = bel`<a title="${glossary(label)}" class=${css.fnName}><span class=${css.name}>${fn.name}</span></a>`
      var title = bel`<h3 class=${css.title} onclick=${e=>toggle(e, null, null)}>${fnName}</h3>`
      var send = bel`<button class="${css.button} ${css.send}" onclick=${e => sendTx(fn.name, label, e)}><i class="${css.icon} fa fa-arrow-circle-right"></i></button>`
      var functionClass = css[label]
      var el = bel`
      <div class=${css.fnContainer}>
        <div class="${functionClass} ${css.function}">
          ${title}
          <div class=${css.visible}>
            ${fn.inputs}
            <div class=${css.actions}>
            ${send}
            </div>
          </div>
        </div>
      </div>`
      if (label === 'payable')  send.parentNode.insertAdjacentElement('beforeBegin', inputPayable(label))
      return el
    }

    async function sendTx (fnName, label, e) {
      var loader = bel`<div class=${css.txReturnItem}>Awaiting network confirmation ${loadingAnimation(colors)}</div>`
      var container = e.target.parentNode.parentNode.parentNode.parentNode
      var txReturn = container.querySelector("[class^='txReturn']") || bel`<div class=${css.txReturn}></div>`
      if (contract) {  // if deployed
        container.appendChild(txReturn)
        txReturn.appendChild(loader)
        let signer = await provider.getSigner()
        var allArgs = getArgs(container, 'inputContainer')
        var args = allArgs.args
        try {
          let contractAsCurrentSigner = contract.connect(signer)
          var transaction
          if (allArgs.overrides) { transaction = await contractAsCurrentSigner.functions[fnName](...args, allArgs.overrides) }
          else { transaction = await contractAsCurrentSigner.functions[fnName](...args) }
          let abi = solcMetadata.output.abi
          loader.replaceWith(await makeReturn(contract, solcMetadata, provider, transaction, fnName))
        } catch (e) { txReturn.children.length > 1 ? txReturn.removeChild(loader) : container.removeChild(txReturn) }
      } else {
        let deploy = document.querySelector("[class^='deploy']")
        deploy.classList.add(css.bounce)
        setTimeout(()=>deploy.classList.remove(css.bounce), 3500)
      }
    }

    function toggleAll (e) {
      var fnContainer = e.currentTarget.parentElement.parentElement.children[3]
      var constructorToggle = e.currentTarget.children[0]
      var constructorIcon = constructorToggle.children[0]
      constructorToggle.removeChild(constructorIcon)
      var minus = bel`<i class="fa fa-minus-circle" title="Collapse">`
      var plus = bel`<i class="fa fa-plus-circle title='Expand to see the details'">`
      var icon = constructorIcon.className.includes('plus') ? minus : plus
      constructorToggle.appendChild(icon)
      for (var i = 0; i < fnContainer.children.length; i++) {
        var fn = fnContainer.children[i]
        var e = fn.children[0]
        toggle(e, fn, constructorIcon)
      }
    }

    function toggle (e, fun, constructorIcon) {
      var fn
      var toggleContainer
      function removeLogs (el) {
        var txReturn = el.parentNode.querySelectorAll("[class^='txReturn']")[0]
        if (txReturn) {
          txReturn.classList.remove(css.visible)
          txReturn.classList.add(css.hidden)
          txReturn.style.minHeight = 0
        }
      }
      function addLogs (el) {
        var txReturn = el.parentNode.querySelectorAll("[class^='txReturn']")[0]
        if (txReturn) {
          txReturn.classList.remove(css.hidden)
          txReturn.classList.add(css.visible)
          txReturn.style.minHeight = '80px'
        }
      }
      // TOGGLE triggered by toggleAll
      if (fun != null) {
        fn = fun.children[0]
        toggleContainer = e.children[1]
        var fnInputs = fn.children[1]
        // Makes sure all functions are opened or closed before toggleAll executes
        if (constructorIcon.className.includes('plus') && fnInputs.className === css.visible.toString()) {
          fnInputs.classList.remove(css.visible)
          fnInputs.classList.add(css.hidden)
          removeLogs(fn)
        }
        else if (constructorIcon.className.includes('minus') && fnInputs.className === css.hidden.toString()) {
          fnInputs.classList.remove(css.hidden)
          fnInputs.classList.add(css.visible)
          addLogs(fn)
        }
      // TOGGLE triggered with onclick on function title (toggle single function)
      } else {
        fn = e.currentTarget.parentNode
        toggleContainer = e.currentTarget.children[1]
      }
      // TOGGLE input fields in a function
      var params = fn.children[1]
      if (params.className === css.visible.toString()) {
        params.classList.remove(css.visible)
        params.classList.add(css.hidden)
        removeLogs(fn)
      } else {
        params.classList.remove(css.hidden)
        params.classList.add(css.visible)
        addLogs(fn)
      }
    }

// Create and deploy contract using WEB3
    async function deployContract() {
      let abi = solcMetadata.output.abi
      let bytecode = opts.metadata.bytecode
      provider =  await getProvider()
      let signer = await provider.getSigner()
      var el = document.querySelector("[class^='ctor']")
      let factory = await new ethers.ContractFactory(abi, bytecode, signer)
      el.replaceWith(bel`<div class=${css.deploying}>Publishing to Ethereum network ${loadingAnimation(colors)}</div>`)
      try {
        var allArgs = getArgs(el, 'inputContainer')
        let args = allArgs.args
        var instance
        if (allArgs.overrides) { instance = await factory.deploy(...args, allArgs.overrides) }
        else { instance = await factory.deploy(...args) }
        // instance = await factory.deploy(...args)
        contract = instance
        let deployed = await contract.deployed()
        topContainer.innerHTML = ''
        topContainer.appendChild(makeDeployReceipt(provider, contract))
        activateSendTx(contract)
      } catch (e) {
        let loader = document.querySelector("[class^='deploying']")
        loader.replaceWith(ctor)
      }
    }

    function activateSendTx(instance) {
      let sendButtons = document.querySelectorAll("[class^='send']")
      for(var i = 0;i < sendButtons.length;i++) {
        sendButtons[i].style.color = colors.slateGrey
      }
      for(var i = 0;i < sendButtons.length;i++) {
        sendButtons[i].style.color = colors.whiteSmoke
      }
    }

    var topContainer = bel`<section class=${css.topContainer}></section>`
    var ctor = bel`<div class="${css.ctor}">
      ${metadata.constructorInput}
      <div class=${css.actions}>
        <button class="${css.button} ${css.deploy}" onclick=${()=>deployContract()} title="Publish the contract first (this executes the Constructor function). After that you will be able to start sending/receiving data using the contract functions below.">
          <i class="${css.icon} fa fa-arrow-circle-right"></i>
        </button>
      </div>
    </div>`
    topContainer.appendChild(ctor)

    return bel`
    <div class=${css.preview}>
      ${themeSwitch()}
      <section class=${css.constructorFn}>
        <h1 class=${css.contractName} onclick=${e=>toggleAll(e)} title="Expand to see the details">
          ${metadata.constructorName}
          <span class="${css.icon} ${css.expend}"><i class="fa fa-minus-circle" title="Expand to see the details"></i></span>
        </h1>
      </section>
      ${topContainer}
      <section class=${css.functions}>${sorted.map(fn => { return functions(fn)})}</section>
    </div>`
  }
}

/******************************************************************************
  CSS
******************************************************************************/

css = csjs`
html {
  font-size: 62.5%;
}
body {
  margin: 0;
  background-color: ${colors.bodyBackgroundColor};
  font-family: ${colors.bodyFont};
  font-size: ${colors.bodyFontSize};
  color: ${colors.bodyTextColor}
}
h1, h2, h3, h4, h5, h6 {
  margin: 0;
}
.themeSwitch {
  text-align: right;
}
button {
  border: none;
  background: none;
  outline: none;
}
.button {
}
.colorplate {
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-left: 5px;
  border: 1px solid #888;
  border-radius: 6px;
  cursor: pointer;
}
.cubeWhite {
  background-color: #fff;
}
.cubeDark {
  background-color: #1D1D26;
}
.preview {
  max-width: 560px;
  margin: 0 auto;
  padding: 1% 2%;
}
.error {
  border: 1px solid ${colors.violetRed};
  position: relative;
  padding: 1em;
}
.errorTitle {
  position: absolute;
  top: -14px;
  left: 20px;
  background-color: ${colors.dark};
  padding: 0 5px 0 5px;
  font-size: 1.3rem;
  color: ${colors.violetRed};
}
.errorIcon {
  font-size: 1.3rem;
}
.visible {
  visibility: visible;
  height: 100%;
}
.hidden {
  visibility: hidden;
  height: 0;
}
.txReturn {
}
.deploying {
  font-size: 1.8rem;
  margin-left: 3%;
}
.txReturnItem {
  font-size: ${colors.txReturnItemFontSize};
  color: ${colors.txReturnItemColor};
  background-color: ${colors.txReturnItemBackgroundColor}
}
.contractName {
  position: relative;
  cursor: pointer;
  font-size: 2rem;
  font-weight: bold;
  text-align: center;
  color: ${colors.contractNameColor};
  margin: 20px 0;
}
.contractName:hover {
  ${hover()}
}
.fnName {
  font-size: 2rem;
  text-decoration: none;
}
.faIcon {
}
.name {
  font-size: ${colors.nameFontSize};
}
.stateMutability {
  margin-left: 5px;
  color: ${colors.whiteSmoke};
  border-radius: 20px;
  padding: 1px;
  font-size: 1.4rem;
}
.constructorFn {
}
.functions {
}
.title {
  font-size: ${colors.titleFontSize};
  margin-bottom: 16px;
}
.deployTitle {
  font-size: ${colors.deployTitleFontSize};
  background-color: transparent;
  padding: 0 5px 0 0;
  font-weight: 800;
}
.deploy {
  color: ${colors.deployColor};
  font-size: ${colors.deployFontSize};
  background-color: ${colors.deployBackgroundColor};
  padding: 0;
} 
.deploy:hover, .send:hover, .title:hover {
  ${hover()}
}
.send {
  color: ${colors.sendColor};
  font-size: ${colors.sendFontSize};
  background-color: ${colors.sendBackgroundColor};
  padding: 0;
}
.bounce {
  animation: bounceRight 2s infinite;
}
@-webkit-keyframes bounceRight {
0% {-webkit-transform: translateX(0);
  transform: translateX(0);}
20% {-webkit-transform: translateX(0);
  transform: translateX(0);}
40% {-webkit-transform: translateX(-30px);
  transform: translateX(-30px);}
50% {-webkit-transform: translateX(0);
  transform: translateX(0);}
60% {-webkit-transform: translateX(-15px);
  transform: translateX(-15px);}
80% {-webkit-transform: translateX(0);
  transform: translateX(0);}
100% {-webkit-transform: translateX(0);
  transform: translateX(0);}
}
@-moz-keyframes bounceRight {
  0% {transform: translateX(0);}
  20% {transform: translateX(0);}
  40% {transform: translateX(-30px);}
  50% {transform: translateX(0);}
  60% {transform: translateX(-15px);}
  80% {transform: translateX(0);}
  100% {transform: translateX(0);}
}
@keyframes bounceRight {
  0% {-ms-transform: translateX(0);
    transform: translateX(0);}
  20% {-ms-transform: translateX(0);
    transform: translateX(0);}
  40% {-ms-transform: translateX(-30px);
    transform: translateX(-30px);}
  50% {-ms-transform: translateX(0);
    transform: translateX(0);}
  60% {-ms-transform: translateX(-15px);
    transform: translateX(-15px);}
  80% {-ms-transform: translateX(0);
    transform: translateX(0);}
  100% {-ms-transform: translateX(0);
    transform: translateX(0);}
}
.fnContainer {
  padding: 14px 12px 0px 20px;
  margin-bottom: 20px;
  border-radius: ${colors.fnContainerBorderRadius};
  border: ${colors.fnContainerBorder};
  background-color: ${colors.fnContainerBackgroundColor};
  box-shadow: ${colors.fnContainerBoxShadow};
}
.function {
  position: relative;
}
.topContainer {
  padding: 14px 12px 0px 20px;
  margin-bottom: 20px;
  border-radius: ${colors.topContainerBorderRadius};
  border: ${colors.topContainerBorder};
  background-color: ${colors.topContainerBackgroundColor};
}
.ctor {
  display: grid;
  grid-template-rows: auto;
  grid-template-columns: auto;
}
.signature {
  
}
.pure {
  color: ${colors.yellow};
}
.view {
}
.nonpayable {
}
.payable {
}
.icon {
  font-size: 2.6rem;
}
.output {
  position: absolute;
  top: 5px;
  right: 5px;
  padding-left: 10px;
  align-self: center;
}
.valError {
  color: ${colors.valErrorColor};
  margin-right: 5px;
}
.valSuccess {
  color: ${colors.valSuccessColor};
}
.inputContainer {
  display: grid;
  grid-template-columns: 100px auto;
  grid-template-rows: auto;
  margin-bottom: 15px;
}
.inputParam {
  padding: ${colors.inputParamPadding};
  color: ${colors.inputParamColor};
  font-size: ${colors.inputParamFontSize};
  text-align: ${colors.inputParamTextAlign};
}
.inputFields {
  position: relative;
  display: inline-grid;
  grid-row-gap: 20px;
  align-items: center;
}
.inputType {
}
.inputField {
  font-family: 'Nunito', sans-serif;
  font-size: ${colors.inputFieldFontSize};
  color: ${colors.inputFieldColor};
  background-color: ${colors.inputFieldBackgroundColor};
  text-align: ${colors.inputFieldTextAlign};
  padding: 6px 28px 6px 12px;
  border-radius: ${colors.inputFieldBorderRadius};
  border: ${colors.inputFieldBorder};
}
.inputField::placeholder {
  color: ${colors.inputFieldPlaceholderColor};
}
.integerValue {
  font-size: ${colors.integerValueFontSize};
  color: ${colors.integerValueColor};
  background-color: ${colors.integerValueBackgroundColor};
  border-radius: ${colors.integerValueBorderRadius};
  border: ${colors.integerValueBorder};
  text-align: ${colors.integerValueTextAlign};
  padding: 6px 30px 6px 12px;
}
.integerValue::placeholder {
  color: ${colors.integerValuePlaceholderColor};
}
.integerSlider {
  width: 100%;
  background-color: ${colors.integerSliderBackgroundColor};
  -webkit-appearance: none;
  height: 6px;
  border-radius: 3px;
  outline: none;
  grid-row: 2;
}
.integerSlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  border-radius: 50%;
  height: 16px;
  width: 16px;
  background-color: ${colors.integerThumbBackgroundColor};
  box-shadow: 0 0 10px rgba(0, 0, 0, .3);
  cursor: pointer;
}
.integerField {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto 40px;
  grid-column-gap: 5px;
  align-items: center;
}
.booleanField {
  position: relative;
  display: grid;
  grid-template-columns: auto auto 30px;
  grid-template-rows: auto;
  grid-column-gap: 5px;
  align-items: center;
}
.booleanField .columns {
  display: inline-grid;
  justify-content: center;
  width: calc(100% - 20px);
  font-size: ${colors.booleanFieldFontSize};
  color: ${colors.booleanFieldColor};
  background-color: ${colors.booleanFieldBackgroundColor};
  padding: 6px 10px;
  border-right: none;
  border-radius: 2px;
  cursor: pointer;
}
.stringField, .byteField, .addressField {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  grid-column-gap: 5px;
}
.keyField {
  ${inputStyle()}
  border-right: none;
  background-color: ${colors.aquaMarine};
  border-color: ${colors.whiteSmoke};
}
.false {
}
.true {
}
.arrayContainer {
  display: grid;
  grid-row-gap: 5px;
}
.arrayPlusMinus {
  text-align: ${colors.arrayPlusMinusTextAlign};
  font-size: ${colors.arrayPlusMinusFontSize};
  color: ${colors.arrayPlusMinusColor};
}
.arrayPlus {
  cursor: pointer;
}
.arrayMinus {
  cursor: pointer;
  margin-right: 15px;
}
.actions {
  text-align: right;
  padding-bottom: 14px;
}
.expend {
  position: absolute;
  right: 5px;
  top: -5px;
}
.txReceipt {
  display: grid;
  grid-template: auto / 1fr;
  grid-row-gap: 20px;
}
.txReturnTitle {
  color: ${colors.txReturnTitleColor};
  font-size: ${colors.txReturnTitleFontSize};
}
.txReturnValue {
  color: ${colors.txReturnValueColor};
  font-size: ${colors.txReturnValueFontSize};
}
.infoIcon {
  text-align: right;
}
.infoIcon a {
  font-size: 2.4rem;
  color: #A0A0FF;
}
@media (max-width: 640px) {
  .preview {
    max-width: 100%;
  }
}
`

function inputStyle() {
  return `
    background-color: ${colors.darkSmoke};
  `
}

function hover () {
  return `
    cursor: pointer;
    opacity: 0.6;
  `
}
