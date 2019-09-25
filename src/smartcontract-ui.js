const bel = require("bel")
const csjs = require("csjs-inject")

const getProvider = require('wallet')
const getTxOutput = require('getTxOutput')

const patchResult = require('helper/patch-result')

const ethers = require('ethers')
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
const theme = require('../demo/node_modules/theme')

const id = 'smartcontract-ui'
var counter = 1

module.exports = smartcontractui

function smartcontractui ({ data, theme = {} }, protocol) {
  const name = `${id}/${counter++}`
  const css = theme.classes || classes
  const vars = theme.variables || variables

  const notify = protocol(msg => {
    const { type, body } = msg
    console.log(`[${name}] receives:`, msg)
    if (type === 'theme') return updateTheme(body)
  })

  const opts = patchResult(data) // compilation result metadata

  const colors = vars
  var provider
  var contract

  if (!opts || !opts.metadata) return notify({ type: 'error', body: opts })
  if (Array.isArray(opts.metadata)) return notify({ type: 'error', body: opts })

  const solcMetadata = opts.metadata
  const metadata = {
    compiler: solcMetadata.compiler.version,
    compilationTarget: solcMetadata.settings.compilationTarget,
    constructorName: getConstructorName(),
    constructorInput: getConstructorInput(),
    functions: getContractFunctions()
  }
  const sorted = sort(metadata.functions)

  const topContainer = bel`<section class=${css.topContainer}></section>`
  const ctor = bel`<div class="${css.ctor}">
    ${metadata.constructorInput}
    <div class=${css.actions}>
      <button id="publish" class="${css.button} ${css.deploy}" onclick=${deployContract} title="Publish the contract first (this executes the Constructor function). After that you will be able to start sending/receiving data using the contract functions below.">
        PUBLISH <i class="${css.icon} fa fa-arrow-right"></i>
      </button>
    </div>
  </div>`
  topContainer.appendChild(ctor)

  const el = bel`<div class=${css.smartcontractui}>
    <section class=${css.constructorFn}>
      <h1 class=${css.contractName} onclick=${e=>toggleAll(e)} title="Expand to see the details">
        ${metadata.constructorName}
        <span class="${css.icon} ${css.expend}"><i class="fa fa-angle-right" title="Expand to see the details"></i></span>
      </h1>
    </section>
    ${topContainer}
    <section class=${css.functions}>${sorted.map(fn => { return functions(fn)})}</section>
  </div>`

  updateTheme(vars)
  return el
  function updateTheme (vars) {
    // Object.keys(variables).forEach(name => {
    console.log('@todo: fix `variables` below by removing all non-needed ones')
    Object.keys(vars).forEach(name => {
      el.style.setProperty(`--${name}`, vars[name])
    })
  }
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
    const glossary = require('glossary')
    var theme = { classes: css }
    var label = fn.stateMutability
    var fnName = bel`<a title="${glossary(label)}" class=${css.fnName}><span class=${css.name}>${fn.name}</span></a>`
    var title = bel`<h3 class=${css.title} onclick=${e=>toggle(e, null, null)}>${fnName}</h3>`
    var send = bel`<button class="${css.button} ${css.send}"
              onclick=${e => sendTx(fn.name, label, e)}>SEND <i class="${css.icon} fa fa-arrow-right"></i></button>`
    var functionClass = css[label]
    var el = bel`
    <div class=${css.fnContainer}>
      <div class="${functionClass} ${css.function}">
        ${title}
        <div class=${css.visible}>
          <div class=${css.inputsList}>
            ${fn.inputs}
          </div>
          <div class=${css.actions}>
            ${send}
          </div>
        </div>
      </div>
    </div>`
    if (label === 'payable')  send.parentNode.insertAdjacentElement('beforeBegin', inputPayable({ theme, label}))
    return el
  }
  async function sendTx (fnName, label, e) { //CHANGE
    var theme = { classes: css, colors }
    var loader = bel`<div class=${css.txReturnItem}>${loadingAnimation(colors, 'Awaiting network confirmation')}</div>`
    var container = e.target.parentNode.parentNode
    var sibling = e.target.parentNode.previousElementSibling
    var txReturn = container.querySelector("[class^='txReturn']") || bel`<div class=${css.txReturn}></div>`
    if (contract) {  // if deployed
      container.insertBefore(txReturn, sibling)
      // container.appendChild(txReturn)
      txReturn.appendChild(loader)
      let signer = await provider.getSigner()
      var allArgs = getArgs(container, 'inputContainer')
      const args = allArgs.args
      try {
        let contractAsCurrentSigner = contract.connect(signer)
        const fn = contract.interface.functions[fnName]
        var transaction
        if (allArgs.overrides) { transaction = await contractAsCurrentSigner.functions[fnName](...args, allArgs.overrides) }
        else { transaction = await contractAsCurrentSigner.functions[fnName](...args) }
        const output = fn.type === "transaction" ?
          await getTxOutput(contract, fnName, provider, args) : null
        const data = { contract, solcMetadata, provider, transaction, fnName, output } // CHANGE
        loader.replaceWith(await makeReturn({ data }, () => {}))
      } catch (e) { txReturn.children.length > 1 ? txReturn.removeChild(loader) : container.removeChild(txReturn) }
    } else {
      let deploy = document.querySelector("#publish")
      deploy.classList.add(css.bounce)
      setTimeout(()=>deploy.classList.remove(css.bounce), 3500)
    }
  }
  function toggleAll (e) {
    var fnContainer = e.currentTarget.parentElement.parentElement.children[2]
    var constructorToggle = e.currentTarget.children[0]
    var constructorIcon = constructorToggle.children[0]
    constructorToggle.removeChild(constructorIcon)
    var on = bel`<i class="fa fa-angle-right ${css.collapse}" title="Collapse">`
    var off = bel`<i class="fa fa-angle-right ${css.expend}" title="Expand to see the details">`
    var icon = constructorIcon.className.includes('expend') ? on : off
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
    // TOGGLE triggered by toggleAll
    if (fun != null) {
      fn = fun.children[0]
      toggleContainer = e.children[1]
      var fnInputs = fn.children[1]
      // Makes sure all functions are opened or closed before toggleAll executes
      if (constructorIcon.className.includes('expend') && fnInputs.className === css.visible.toString()) {
        fnInputs.classList.remove(css.visible)
        fnInputs.classList.add(css.hidden)
        removeLogs(fn)
      }
      else if (constructorIcon.className.includes('collapse') && fnInputs.className === css.hidden.toString()) {
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
  }
  async function deployContract () { // Create and deploy contract using WEB3
    var theme = { classes: css }
    let abi = solcMetadata.output.abi
    let bytecode = opts.metadata.bytecode
    provider =  await getProvider()
    let signer = await provider.getSigner()

    var el = document.querySelector("[class^='ctor']")
    let factory = await new ethers.ContractFactory(abi, bytecode, signer)
    const loader = bel`<div class=${css.deploying}>${loadingAnimation(colors, 'Publishing to Ethereum network')}</div>`
    el.replaceWith(loader)
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
      const theme = { variables: colors }
      const data = { provider, contract }
      topContainer.appendChild(makeDeployReceipt({ data, theme }, notify => msg => {
        console.log(`[${name}] receives:`, msg)
      }))
      activateSendTx(contract)
    } catch (e) {
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
}
const classes = csjs`
.button {
}
.smartcontractui {
  max-width: 560px;
  margin: 0 auto;
  padding: 1% 2%;
}
.error {
  border: 1px solid var(--violetRed);
  position: relative;
  padding: 1em;
}
.errorTitle {
  position: absolute;
  top: -14px;
  left: 20px;
  background-color: var(--dark);
  padding: 0 5px 0 5px;
  font-size: 1.3rem;
  color: var(--violetRed);
}
.errorIcon {
  font-size: 1.3rem;
}
.visible {
  display: block;
  border: 1px solid #1d1d26;
  background-color: var(--visibleBackgroundColor);
  padding: 22px 30px 10px 22px;
  border-radius: 4px;
  transform: scale(1);
  transition: transform .6s, border .6s ease-out;
  -webkit-transition: transform .6s, border .6s ease-out;
}
.hidden {
  display: none;
}
.txReturn {
  position: relative;
  z-index: 3;
  margin: 0 -30px 22px -22px;
  max-height: 180px;
  overflow-hidden;
  overflow-y: auto;
}
.deploying {
  margin: 0;
}
.txReturnItem {
  margin: 0 0 1px 0;
  padding: 20px 0;
  text-align: var(--txRetrunTextAlign);
  background-color: var(--txReturnItemBackgroundColor)
}
.txReturnItem .infoIcon {
  right: 6px;
  botom: 6px;
}
.contractName {
  position: relative;
  cursor: pointer;
  font-size: 2rem;
  font-weight: bold;
  text-align: center;
  color: var(--contractNameColor);
  margin: 20px 0;
}
.contractName:hover {
  opacity: .6;
}
.fnName {
  font-size: 2rem;
  text-decoration: none;
}
.faIcon {
}
.name {
  font-size: var(--nameFontSize);
}
.stateMutability {
  margin-left: 5px;
  color: var(--whiteSmoke);
  border-radius: 20px;
  padding: 1px;
  font-size: 1.4rem;
}
.constructorFn {
}
.functions {
}
.title {
  font-size: var(--titleFontSize);
  margin-bottom: 16px;
}
.deployTitle {
  font-size: var(--deployTitleFontSize);
  background-color: transparent;
  padding: 0 5px 0 0;
  font-weight: 800;
}
.deploy {
  color: var(--deployColor);
  font-size: var(--deployFontSize);
  background-color: var(--deployBackgroundColor);
  border-radius: 30px;
  padding: 10px 17px 10px 22px;
  position: absolute;
  top: -8px;
  right: -35px;
  transition: background-color .6s ease-in-out;
}
.deploy:hover, .send:hover {
  ${hover()}
}
.deploy:hover .icon, .send:hover .icon {
  animation: arrowMove 1s ease-in-out infinite;
}
@keyframes arrowMove {
  0% {
    right: 0;
  }
  50% {
    right: -10px;
  }
  100% {
    right: 0;
  }
}
@-webki-tkeyframes arrowMove {
  0% {
    right: 0;
  }
  50% {
    right: -10px;
  }
  100% {
    right: 0;
  }
}
.title:hover  {
  cursor: pointer;
  opacity: .6;
}
.send {
  color: var(--sendColor);
  font-size: var(--sendFontSize);
  background-color: var(--sendBackgroundColor);
  padding: 10px 17px 10px 22px;
  border-radius: 30px;
  position: absolute;
  right: -35px;
  bottom: -28px;
  transition: background-color .6s ease-in-out;
}
.send .icon {
  font-size: 1.2rem;
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
  padding: 0px;
  margin-bottom: 20px;
  border-radius: var(--fnContainerBorderRadius);
  border: var(--fnContainerBorder);
  background-color: var(--fnContainerBackgroundColor);
  box-shadow: var(--fnContainerBoxShadow);
}
.fnContainer .deploying {
  padding: 20px 14px 20px 20px;
  margin:1px -12px 0 -20px;
  background-color: rgba(128,134,186, .6);
}
.function {
  position: relative;
}
.topContainer {
  margin-bottom: 20px;
  border-radius: var(--topContainerBorderRadius);
  border: var(--topContainerBorder);
  background: var(--topContainerBackgroundColor);
  padding: 22px 10px 12px 22px;
  transform: scale(1);
  -webkit-transition: transform .5s, border .5s ease-out;
  transition: transform .5s, border .5s ease-out;
}
.ctor {
  display: grid;
  grid-template-rows: auto;
  grid-template-columns: auto;
}
.topContainer:hover, .fnContainer:hover .visible {
  border: 1px solid rgba(103,25,255, .25);
  box-shadow: 0px 6px 20px rgba(0, 0, 0, .3);
  transform: scale(1.02);
  -webkit-transform: scale(1.02);
}
.topContainer:before, .visible:before {
  content: '';
  display: block;
  background: var(--cardHoverGradientBackground);
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: 1;
  opacity: 0;
  transition: opacity .6s ease-in-out;
}
.topContainer:hover:before, .fnContainer:hover .visible:before {
  opacity: 1;
}
.topContainer:hover .inputParam, .fnContainer:hover .inputParam {
  color: var(--inputParamColorHover);
}
.topContainer:hover .txReceipt .txReturnValue {
  color: var(--txReturnValueColorHover);
}
.signature {

}
.pure {
  color: var(--yellow);
}
.view .name {
  color: var(--fnViewNameColor)
}
.nonpayable .name {
  color: var(--fnNonPayableNameColor)
}
.payable .name {
  color: var(--fnPayableNameColor)
}
.icon {
  font-size: 1.6rem;
  position: relative;
}
.output {
  position: absolute;
  top: 5px;
  right: -25px;
  align-self: center;
}
.output i {
  font-size: 1.2rem;
}
.valError {
  color: var(--valErrorColor);
  margin-right: 5px;
}
.valSuccess {
  color: var(--valSuccessColor);
}
.inputContainer {
  display: grid;
  grid-template-columns: 100px auto;
  grid-template-rows: auto;
  margin-bottom: 22px;
  position: relative;
  z-index: 3;
}
.inputParam {
  padding: var(--inputParamPadding);
  color: var(--inputParamColor);
  font-size: var(--inputParamFontSize);
  text-align: var(--inputParamTextAlign);
  transition: color .6s ease-in-out;
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
  font-size: var(--inputFieldFontSize);
  color: var(--inputFieldColor);
  background-color: var(--inputFieldBackgroundColor);
  text-align: var(--inputFieldTextAlign);
  padding: 6px 28px 6px 12px;
  border-radius: var(--inputFieldBorderRadius);
  border: var(--inputFieldBorder);
  width: calc(100% - 40px)
}
.inputField::placeholder {
  color: var(--inputFieldPlaceholderColor);
}
.integerValue {
  width: calc(100% - 26px);
  font-size: var(--integerValueFontSize);
  color: var(--integerValueColor);
  background-color: var(--integerValueBackgroundColor);
  border-radius: var(--integerValueBorderRadius);
  border: var(--integerValueBorder);
  text-align: var(--integerValueTextAlign);
  padding: 6px 12px;
}
.integerValue::placeholder {
  color: var(--integerValuePlaceholderColor);
}
.integerSlider {
  -webkit-appearance: none;
  background-color: transparent;
  width: 100%;
  max-width: 100%;
  border-radius: 3px;
  grid-row: 2;
}
.topContainer:hover .integerSlider::-webkit-slider-runnable-track, .fnContainer:hover .integerSlider::-webkit-slider-runnable-track {
  background-color: #6700FF;
}
/* track */
.integerSlider::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background-color: var(--integerSliderBackgroundColor);
  border-radius: 3px;
  grid-row: 2;
  transition: background-color .3s ease-in-out;
}
.integerSlider:active::-webkit-slider-runnable-track {
  background-color: var(--integerSliderFocusBackgroundColor);
}
.integerSlider::-moz-range-track {
  width: 100%;
  height: 6px;
  background-color: var(--integerSliderBackgroundColor);
  border-radius: 3px;
  cursor: pointer;
}
input[type="range"]::-ms-track {
  width: 100%;
  height: 6px;
  cursor: pointer;
  background: transparent;
  border-color: transparent;
  color: transparent;
}
input[type="range"]::-ms-fill-lower {
  background: var(--integerSliderBackgroundColor);
}

input[type="range"]:focus::-ms-fill-lower {
  background: var(--integerSliderFocusBackgroundColor);
}

input[type="range"]::-ms-fill-upper {
  background: var(--integerSliderBackgroundColor);
}

input[type="range"]:focus::-ms-fill-upper {
  background: #ddd;
}
/* thumb */
.integerSlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background-color: var(--integerThumbBackgroundColor);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 0, 0, .3);
  margin-top: -6px;
  cursor: pointer;
}
.integerSlider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background-color: var(--integerThumbBackgroundColor);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 0, 0, .3);
  cursor: pointer;
}
.integerSlider::-ms-range-thumb {
  width: 16px;
  height: 16px;
  background-color: var(--integerThumbBackgroundColor);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 0, 0, .3);
  margin-top: -2px;
  cursor: pointer;
}
.integerSlider:focus {
  outline: none;
}
.integerSlider::-ms-track {
  width: 100%;
  border-radius: 3px;
  cursor: pointer;
  background: transparent;
  border-color: transparent;
  color: transparent;
}
.integerField {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto 30px;
  grid-column-gap: 5px;
  align-items: center;
}
.booleanField {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, auto);
  grid-template-rows: auto;
  grid-column-gap: 5px;
  align-items: center;
}
.booleanField .columns {
  display: inline-grid;
  justify-content: center;
  width: calc(100% - 20px);
  font-size: var(--booleanFieldFontSize);
  color: var(--booleanFieldColor);
  background-color: var(--booleanFieldBackgroundColor);
  padding: 6px 10px;
  border-right: none;
  border-radius: 2px;
  cursor: pointer;
}
.booleanField .true[data-state='active'] {
  color: var(--booleanFieldActiveColor);
  background-color: var(--booleanFieldTruedBackgroundColor);
}
.booleanField .false[data-state='active'] {
  color: var(--booleanFieldActiveColor);
  background-color: var(--booleanFieldFalsedBackgroundColor);
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
  background-color: var(--aquaMarine);
  border-color: var(--whiteSmoke);
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
  text-align: var(--arrayPlusMinusTextAlign);
  font-size: var(--arrayPlusMinusFontSize);
  color: var(--arrayPlusMinusColor);
}
.arrayPlus {
  cursor: pointer;
}
.arrayMinus {
  cursor: pointer;
  margin-right: 15px;
}
.actions {
  position: relative;
  text-align: right;
  z-index: 3;
}
.expend {
  position: absolute;
  right: 5px;
  top: 3px;
}
.expend i {
  transform: rotate(90deg);
  margin-left: -15px;
}
.expend .expend {
  animation: expendOff .3s ease-in forwards;
}
.expend .collapse {
  animation: expendOn .3s ease-out forwards;
}
@-webkit-keyframes expendOn {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(90deg);
  }
}
@keyframes expendOn {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(90deg);
  }
}
@-webkit-keyframes expendOff {
  0% {
    transform: rotate(-90deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes expendOff {
  0% {
    transform: rotate(90deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

.txReceipt {
  display: grid;
  grid-template: auto / 1fr;
  grid-row-gap: 20px;
  position: relative;
  z-index: 3;
}
.txReturnField {

}
.txReturnTitle {
  color: var(--txReturnTitleColor);
  font-size: var(--txReturnTitleFontSize);
}
.txReturnValue {
  color: var(--txReturnValueColor);
  font-size: var(--txReturnValueFontSize);
  text-align: center;
}
.inputArea {
  display: grid;
  grid-template: auto / auto auto 30px;
  grid-column-gap: 5px;
}
.currency {
  font-family: var(--bodyFont);
  border-radius: var(--currencyBorderRadius);
  border: var(--currencyBorder);
  padding: 5px 7px;
  color: var(--currencyColor);
  background-color: var(--currencyBackgroundColor);
  font-size: var(--currencyFontSize);
}
.ethIcon {
  color: var(--ethIconColor);
  font-size: var(--ethIconFontSize);
  text-align: center;
  align-self: center;
}
.inputsList {

}
@media (max-width: 640px) {
  .smartcontractui {
    width: 100%;
  }
}`
function inputStyle() {
  return `
    background-color: var(--darkSmoke);
  `
}
function hover () {
  return `
    cursor: pointer;
    background-color: rgba(255,255,255, .15)
  `
}
const variables = { // defaults
  darkSmoke: '',
  bodyBackgroundColor: '',
  bodyFont: '',
  bodyFontSize: '',
  bodyTextColor: '',
  violetRed: '',
  dark: '',
  violetRed: '',
  visibleBackgroundColor: '',
  txRetrunTextAlign: '',
  txReturnItemBackgroundColor: '',
  contractNameColor: '',
  nameFontSize: '',
  whiteSmoke: '',
  titleFontSize: '',
  deployTitleFontSize: '',
  deployColor: '',
  deployFontSize: '',
  deployBackgroundColor: '',
  sendColor: '',
  sendFontSize: '',
  sendBackgroundColor: '',
  fnContainerBorderRadius: '',
  fnContainerBorder: '',
  fnContainerBackgroundColor: '',
  fnContainerBoxShadow: '',
  topContainerBorderRadius: '',
  topContainerBorder: '',
  topContainerBackgroundColor: '',
  cardHoverGradientBackground: '',
  inputParamColorHover: '',
  txReturnValueColorHover: '',
  yellow: '',
  fnViewNameColor: '',
  fnNonPayableNameColor: '',
  fnPayableNameColor: '',
  valErrorColor: '',
  valSuccessColor: '',
  inputParamPadding: '',
  inputParamColor: '',
  inputParamFontSize: '',
  inputParamTextAlign: '',
  inputFieldFontSize: '',
  inputFieldColor: '',
  inputFieldBackgroundColor: '',
  inputFieldTextAlign: '',
  inputFieldBorderRadius: '',
  inputFieldBorder: '',
  inputFieldPlaceholderColor: '',
  integerValueFontSize: '',
  integerValueColor: '',
  integerValueBackgroundColor: '',
  integerValueBorderRadius: '',
  integerValueBorder: '',
  integerValueTextAlign: '',
  integerValuePlaceholderColor: '',
  integerSliderBackgroundColor: '',
  integerSliderFocusBackgroundColor: '',
  integerSliderBackgroundColor: '',
  integerSliderBackgroundColor: '',
  integerSliderFocusBackgroundColor: '',
  integerSliderBackgroundColor: '',
  integerThumbBackgroundColor: '',
  integerThumbBackgroundColor: '',
  integerThumbBackgroundColor: '',
  booleanFieldFontSize: '',
  booleanFieldColor: '',
  booleanFieldBackgroundColor: '',
  booleanFieldActiveColor: '',
  booleanFieldTruedBackgroundColor: '',
  booleanFieldActiveColor: '',
  booleanFieldFalsedBackgroundColor: '',
  aquaMarine: '',
  whiteSmoke: '',
  arrayPlusMinusTextAlign: '',
  arrayPlusMinusFontSize: '',
  arrayPlusMinusColor: '',
  txReturnTitleColor: '',
  txReturnTitleFontSize: '',
  txReturnValueColor: '',
  txReturnValueFontSize: '',
  bodyFont: '',
  currencyBorderRadius: '',
  currencyBorder: '',
  currencyColor: '',
  currencyBackgroundColor: '',
  currencyFontSize: '',
  ethIconColor: '',
  ethIconFontSize: '',
}
