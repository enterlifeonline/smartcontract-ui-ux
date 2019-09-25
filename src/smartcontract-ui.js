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
  console.log(opts)
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
    <div class=${css.publishInformation}>
    Publish the contract first (this executes the Constructor function). After that you will be able to start sending/receiving data using the contract functions below.
    </div>
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
        <span class="${css.icon} ${css.expand}"><i class="fa fa-angle-right" title="Expand to see the details"></i></span>
      </h1>
    </section>
    ${topContainer}
    <section class=${css.functions}>${sorted.map(fn => functions(fn) )}</section>
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
    console.log(solcMetadata.settings.compilationTarget[file]);
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
    return functions.filter(x => x.type === 'function').sort((a, b) => {
      var d=type2num(a) - type2num(b)
      if (d==0) {
        if (a.name > b.name) return 1;
        if (a.name < b.name) return -1;
      }
      return d
    })
  }
  function type2num ({ stateMutability: sm }) {
    if (sm === 'view') return 1
    if (sm === 'nonpayable') return 2
    if (sm === 'pure') return 3
    if (sm === 'payable') return 4
    if (sm === undefined) return 5
  }
  function generateInputContainer (field) {
    var theme = { classes: css, colors}
    var name = field.name
    var type = field.type
    var inputField = getInputField( {theme, type, cb, blur})
    var inputContainer = bel`
      <div class=${css.inputContainer}>
        <label class=${css.inputParam} title="data type: ${type}">${name || 'key'}</label>
        <div class=${css.inputFields}>${inputField}</div>
      </div>`
    return inputContainer
    function cb (msg, el, value) {
      var current
      var oldOutput = el.parentNode.querySelector("[class^='output']")
      var output = oldOutput ? oldOutput : output = bel`<span class=${css.output}></span>`
      output.innerHTML = ""
      output.innerHTML = msg ? `<span class=${css.valError} title="${msg}"><i class="fa fa-exclamation"></i></span>` : `<span class=${css.valSuccess} title="The value is valid."><i class="fa fa-check"></i></span>`
      el.parentNode.appendChild(output)
      if (output.children[0].classList.contains(css.valError)) {
        if(el.parentNode.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
          current = el.parentNode.parentNode.parentNode.parentNode
          // console.log('this: ', e.target);
          // console.log('focus: ', current);
        } else if (el.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
          current = el.parentNode.parentNode.parentNode
          // console.log('this: ', e.target);
          // console.log('focus: ', current);
        } else if (el.parentNode.parentNode.classList.contains(css.inputContainer)) {
          current = el.parentNode.parentNode
          // console.log('this: ', e.target);
          // console.log('focus: ', current);
        }
        el.classList.add(css.invalidated)
        current.classList.add(css.invalidated)
      } else {
        if(el.parentNode.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
          current = el.parentNode.parentNode.parentNode.parentNode
          // console.log('this: ', e.target);
          // console.log('focus: ', current);
        } else if (el.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
          current = el.parentNode.parentNode.parentNode
          // console.log('this: ', e.target);
          // console.log('focus: ', current);
        } else if (el.parentNode.parentNode.classList.contains(css.inputContainer)) {
          current = el.parentNode.parentNode
          // console.log('this: ', e.target);
          // console.log('focus: ', current);
        } 
        el.classList.remove(css.invalidated)
        current.classList.remove(css.invalidated)
      }
      
    }
  }
  function getInputField ({ theme, type, cb, focus, blur}) {
    var field
    if ((type.search(/\]/) != -1)) {
      var arrayInfo = type.split('[')[1]
      var digit = arrayInfo.search(/\d/)
      field = inputArray({ theme, type, cb, focus, blur })
    } else {
      if ((type.search(/\buint/) != -1) || (type.search(/\bint/) != -1)) field = inputInteger({ theme, type, cb, focus, blur })
      if (type.search(/\bbyte/) != -1) field = inputByte({ theme, type, cb, focus, blur })
      if (type.search(/\bstring/) != -1) field = inputString({ theme, type, cb, focus, blur })
      if (type.search(/\bfixed/) != -1) field = inputInteger({ theme, type, cb, focus, blur })
      if (type.search(/\bbool/) != -1) field = inputBoolean({ theme, type, cb, focus, blur })
      if (type.search(/\baddress/) != -1) field = inputAddress({ theme, type, cb, focus, blur })
    }
    return field
    function focus(e) {
      var current
      let containers = document.querySelectorAll(`.${css.inputContainer}`)
      containers.forEach( container => container.classList.remove(css.focus))
      if(e.target.parentNode.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode.parentNode.parentNode
      } else if (e.target.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode.parentNode
      } else if (e.target.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode
      } 
      current.classList.add(css.focus)
    }
    function blur(e) {
      var current
      if (e.target.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode
      } else if (e.target.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode.parentNode
      } else if(e.target.parentNode.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode.parentNode.parentNode
      }    
      current.classList.remove(css.focus)
    }
  }
  function functions (fn) {
    const glossary = require('glossary')
    let theme = { classes: css }
    let label = fn.stateMutability
    let fnName = bel`<a title="${glossary(label)}" class=${css.fnName}><span class=${css.name}>${fn.name}</span></a>`
    let constructorIcon = bel`<span class="${css.icon} ${css.expand}"><i class="fa fa-angle-right"></i></span>`
    let title = bel`<h3 class=${css.title} onclick=${e=>toggle(e, null, constructorIcon)}>${fnName} ${constructorIcon}</h3>`
    let send = bel`<button class="${css.button} ${css.send}" onclick=${e => sendTx(fn.name, label, e)} disabled>SEND <i class="${css.icon} fa fa-arrow-right"></i></button>`
    let testButton = bel`<button class="${css.button} ${css.send}" onclick=${ e => sendValue( fn.name, label, e) }>Send</button>`
    let functionClass = css[label]
    let el = bel`
    <div class=${css.fnContainer}>
      <div class="${functionClass} ${css.function}">
        ${title}
        <div class=${css.visible}>
          <div class=${css.logs}></div>
          <div class=${css.inputsList}>
            ${fn.inputs}
          </div>
          <div class=${css.actions}>
            ${send}
          </div>
        </div>
      </div>
    </div>`
    if (label === 'payable')  send.parentNode.insertAdjacentElement('beforeBegin', inputPayable({ theme, label, focus, blur}))
    return el
    function focus(e) {
      var current
      if (e.target.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode
      } else if (e.target.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode.parentNode
      } else if(e.target.parentNode.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode.parentNode.parentNode
      }
      current.classList.add(css.focus)
    }
    function blur(e) {
      var current
      if (e.target.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode
      } else if (e.target.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode.parentNode
      } else if(e.target.parentNode.parentNode.parentNode.parentNode.classList.contains(css.inputContainer)) {
        current = e.target.parentNode.parentNode.parentNode.parentNode.parentNode
      }    
      current.classList.remove(css.focus)
    }
  }
  function sendValue(fn, label, e) {
    let theme = { classes: css, colors }
    let loader = bel`<div class=${css.txReturnItem}>${loadingAnimation(colors, 'Awaiting network confirmation')}</div>`
    let container = e.target.parentNode.parentNode.parentNode.parentNode
    let visible = container.querySelector(`[class^=${css.visible}]`)
    let logs = visible.querySelector(`[class^=${css.logs}]`)
    let txReturn = logs.querySelector("[class^='txReturn']") || bel`<div class=${css.txReturn}></div>`
    let fields = [...container.querySelectorAll(`.${css.inputContainer}`)]
    let el = bel`<div class=${css.txReturnItem}></div>`
    let timer = new Date
    let span = bel`<span class=${css.txReturnCount}>${timer.getUTCHours()}:${timer.getUTCMinutes()}:${timer.getUTCSeconds()}</span>`

    logs.appendChild(txReturn)
    // txReturn.appendChild(loader)

    el.appendChild(bel`<div class=${css.txReturnValue}>'wrwrwerw' ${timer.getUTCSeconds()}</div>`)
    el.appendChild(span)

    try {
      if (fields) {
        fields.forEach( field => {
          let inputs = field.querySelectorAll('input')
          inputs.forEach( input => {
            if (input.type === 'number') {
              el.innerText = input.value
              el.appendChild(span)
            }
          })
        })
      }
      txReturn.appendChild(el)
      logs.scrollTop = logs.scrollHeight
    } catch(e) {
      console.log(txReturn.children)
      txReturn.children.length > 1  ? txReturn.removeChild(loader) : logs.removeChild(txReturn)
    }
  }
  async function sendTx (fnName, label, e) {
    let theme = { classes: css, colors }
    let loader = bel`<div class=${css.txReturnItem}>${loadingAnimation(colors, 'Awaiting network confirmation')}</div>`
    let container = e.target.parentNode.parentNode.parentNode.parentNode
    let visible = container.querySelector(`.${css.visible}`)
    let logs = visible.querySelector(`.${css.logs}`)
    let txReturn = logs.querySelector(`.${css.txReturn}`) || bel`<div class=${css.txReturn}></div>`
    
    // if deployed
    logs.appendChild(txReturn)
    txReturn.appendChild(loader)
    logs.scrollTop = logs.scrollHeight

    let signer = await provider.getSigner()
    let allArgs = getArgs(container, 'inputContainer')
    let args = allArgs.args
    try {
      let contractAsCurrentSigner = contract.connect(signer)
      var transaction
      if (allArgs.overrides) { transaction = await contractAsCurrentSigner.functions[fnName](...args, allArgs.overrides) }
      else { transaction = await contractAsCurrentSigner.functions[fnName](...args) }
      let abi = solcMetadata.output.abi
      const data = { contract, solcMetadata, provider, transaction, fnName }
      loader.replaceWith(await makeReturn({ data }, () => {}))
      logs.scrollTop = logs.scrollHeight
    } catch (e) { txReturn.children.length > 1 ? txReturn.removeChild(loader) : logs.removeChild(txReturn) }
    
  }
  function toggleAll (e) {
    let fnContainer = e.currentTarget.parentElement.parentElement.children[2]
    let constructorToggle = e.currentTarget.children[0]
    let constructorIcon = constructorToggle.children[0]
    constructorToggle.removeChild(constructorIcon)
    let off = bel`<i class="fa fa-angle-right" title="Collapse">`
    let on = bel`<i class="fa fa-angle-right" title="Expand to see the details">`
    let icon = constructorToggle.className.includes('expand') ? on : off
    let toggleClass = constructorToggle.classList.contains(css.expand) ? css.collapse : css.expand

    constructorToggle.className = `${css.icon} ${toggleClass}`
    constructorToggle.appendChild(icon)
    
    
    for (var i = 0; i < fnContainer.children.length; i++) {
      var fn = fnContainer.children[i]
      var e = fn.children[0]
      toggle(e, fn, constructorToggle)
    }
  }
  function toggle (e, fun, constructorToggle) {
    var fn
    var toggleContainer
    // TOGGLE triggered by toggleAll
    // console.log(constructorIcon) // .topContainer i.fa.fa-angle-right
    if (fun != null) {
      fn = fun.children[0] // .function
      toggleContainer = e.children[1] // .visible
      // Makes sure all functions are opened or closed before toggleAll executes
      if ( constructorToggle.className.includes(css.expand) ) {
        if (fn.querySelector(`.${css.collapse}`)) {
          fn.querySelector(`.${css.collapse}`).className = `${css.icon} ${css.expand}`
        }
        toggleContainer.className = css.hidden
      } else {
        if (fn.querySelector(`.${css.expand}`)) {
          fn.querySelector(`.${css.expand}`).className = `${css.icon} ${css.collapse}`
        }
        toggleContainer.className = css.visible
      }
      
    // TOGGLE triggered with onclick on function title (toggle single function)
    } else {
      fn = e.currentTarget.parentNode
      if (constructorToggle.className.includes(css.expand)) {
        constructorToggle.className = `${css.icon} ${css.collapse}`
      } else {
        constructorToggle.className = `${css.icon} ${css.expand}`
      }
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
      }
    }
    function addLogs (el) {
      var txReturn = el.parentNode.querySelectorAll("[class^='txReturn']")[0]
      if (txReturn) {
        txReturn.classList.remove(css.hidden)
        txReturn.classList.add(css.visible)
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

      if (contract) {
        let buttons = document.getElementsByClassName(css.send)
        for ( button of buttons ) {
          button.removeAttribute('disabled')
        }
      }

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
input:focus {
  outline: none;
}
.button {
  cursor: pointer;
}
.button:disabled {
  cursor: not-allowed;
}
.smartcontractui {
  max-width: 640px;
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
  border: var(--visibleBorder);
  background-color: var(--visibleBackgroundColor);
  padding: 0px 30px 22px 22px;
  border-radius: 4px;
  transform: scale(1);
  transition: transform .6s, border .6s ease-out;
  -webkit-transition: transform .6s, border .6s ease-out;
}
.hidden {
  display: none;
}
.txReturn {

}
.deploying {
  margin: 0;
}
.txReturnItem {
  position: relative;
  text-align: var(--txRetrunItemTextAlign);
  background-color: var(--txReturnItemBackgroundColor);
  padding: 20px 0;
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
  margin-top: 20px;
  padding-bottom: 20px;
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
  padding: 6px 22px;
  transition: background-color .6s ease-in-out;
  position: relative;
  right: -15px;
} 
.deploy:hover {
  color: var(--deployHoverColor);
  background-color: var(--deployHoverBackgroundColor);
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
  padding: 6px 22px;
  border-radius: 30px;
  transition: background-color .6s ease-in-out;
  position: relative;
  right: -15px;
}
.send:hover {
  color: var(--sendHoverColor);
  background-color: var(--sendHoverBackgroundColor);
}
.send .icon {
  font-size: 1.2rem;
}
.send:disabled {
  color: #535172;
  background-color: rgba(0,0,0,.25);
}
.send:disabled .icon {
  animation-play-state: paused;
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
  padding: 22px 30px 22px 22px;
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
  border: var(--visibleBorderHover);
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
  z-index: -1;
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
  font-size: 1.2rem;
  position: relative;
}
.output {
  position: absolute;
  top: 5px;
  right: 6px;
  align-self: center;
}
.output i {
  font-size: 1.2rem;
}
.output span {
  display: inline-block;
  border-radius: 30px;
  width: 20px;
  height: 20px;
  text-align: center;
}
.valError {
  color: var(--valErrorColor);
  background-color: var(--valErrorBackgroundColor);
  margin-top: 2px;
  transition: colors .6s, background-color .6s ease-in-out;
}
.valSuccess {
  color: var(--valSuccessColor);
  background-color: var(--valSuccessBackgroundColor);
  transition: colors .6s, background-color .6s ease-in-out;
}
.inputContainer {
  display: grid;
  grid-template-columns: 25% auto;
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
  word-break: break-all;
  transition: color .3s ease-in-out;
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
  border: 1px solid var(--inputFieldBorderColor);
  width: calc(100% - 40px);
  transition: border .6s ease-in-out;
}
.inputField::placeholder {
  color: var(--inputFieldPlaceholderColor);
}
.integerValue {
  width: calc(100% - 42px);
  font-size: var(--integerValueFontSize);
  color: var(--integerValueColor);
  background-color: var(--integerValueBackgroundColor);
  border-radius: var(--integerValueBorderRadius);
  border: var(--integerValueBorder);
  text-align: var(--integerValueTextAlign);
  padding: 6px 30px 6px 10px;
  transition: border .6s ease-in-out;
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
/* track */
.integerSlider::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background-color: var(--integerSliderBackgroundColor);
  border-radius: 3px;
  grid-row: 2;
  transition: background-color .3s ease-in-out;
}
.topContainer:hover .integerSlider::-webkit-slider-runnable-track, .fnContainer:hover .integerSlider::-webkit-slider-runnable-track {
  background-color: var(--integerSliderHoverBackgroundColor);
}
.integerSlider:active::-webkit-slider-runnable-track {
  background-color: var(--integerSliderFocusBackgroundColor);
}
.topContainer:hover .integerSlider:active::-webkit-slider-runnable-track, .fnContainer:hover .integerSlider:active::-webkit-slider-runnable-track {
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
  text-align: center;
  z-index: 3;
}
.expand, .collapse {
  position: absolute;
  right: 5px;
  top: 3px;
  z-index: 3;
}
.expand i {
  transform: rotate(90deg);
  font-size: 1.2rem;
  margin-left: -15px;
  animation: expendOn .3s ease-in forwards;
}
.collapse i {
  font-size: 1.2rem;
  margin-left: -15px;
  animation: expendOff .3s ease-out forwards;
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
  grid-column-gap: 15px;
}
.currency {
  font-family: var(--bodyFont);
  border: var(--currencyBorder);
  padding: 5px 7px;
  color: var(--currencyColor);
  background-color: var(--currencyBackgroundColor);
  font-size: var(--currencyFontSize);
}
.ethIcon {
  color: var(--ethIconColor);
  font-size: var(--ethIconFontSize);
  text-align: left;
  align-self: center;
}
.inputsList {

}
.logs {
  min-height: 100px;
  max-height: 180px;
  background-color: var(--logsBackgroundColor);
  margin: 0 -30px 22px -22px;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  overflow: hidden;
  overflow-y: auto;
}
.txReturnCount {
  position: absolute;
  left: 15px;
  top: 9px;
  padding: 3px 8px;
  font-size: 1.2rem;
  border-radius: 30px;
  color: #ffffff;
  background-color: rgba(255,255,255, .15);
}
.publishInformation {
  margin-bottom: 22px;
  font-size: 1.4rem;
  color: var(--publishInformationColor);
}
.topContainer .focus .inputParam, .topContainer .focus:hover .inputParam,
.fnContainer .focus .inputParam, .fnContainer .focus:hover .inputParam
{
  color: var(--inputFocus);
}
.topContainer .focus .integerValue:focus, .topContainer:focus .focus:hover .integerValue:focus,
.fnContainer .focus .integerValue:focus, .fnContainer .focus:hover .integerValue:focus,
.topContainer .focus .inputField:focus, .topContainer .focus:hover .inputField:focus,
.fnContainer .focus .inputField:focus, .fnContainer .focus:hover .inputField:focus,
.topContainer .integerValue.invalidated:focus, .topContainer:hover .integerValue.invalidated:focus,
.fnContainer .integerValue.invalidated:focus, .fnContainer:hover .integerValue.invalidated:focus,
.topContainer .inputField.invalidated:focus, .topContainer:hover .inputField.invalidated:focus,
.fnContainer .inputField.invalidated:focus, .fnContainer:hover .inputField.invalidated:focus
{
  border: 1px solid var(--inputFocus);
}
.topContainer .invalidated .inputParam, .topContainer .invalidated:hover .inputParam,
.fnContainer .invalidated .inputParam, .fnContainer .invalidated:hover .inputParam
{
  color: var(--inputInvalidated);
}
.topContainer .integerValue.invalidated, .topContainer:hover .integerValue.invalidated,
.fnContainer .integerValue.invalidated, .fnContainer:hover .integerValue.invalidated,
.topContainer .inputField.invalidated, .topContainer:hover .inputField.invalidated,
.fnContainer .inputField.invalidated, .fnContainer:hover .inputField.invalidated
{
  border: 1px solid var(--inputInvalidated);
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
