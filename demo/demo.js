const bel = require('bel')
const csjs = require('csjs-inject')
const solcjs = require('solc-js')

const selectTheme = require('theme')
const makeThemeSwitch = require('theme-switcher')
const getversion = require('get-compiler-version')
const contracts = require('contracts')
const smartcontractui = require('../')

try {
  setTimeout(() => {
    demo(localStorage['theme'] || void 0, localStorage['contract'] || void 0)
  }, 0) // start demo in the next tick so all code can initialize first
} catch (error) {
  console.error(error)
  const data = JSON.stringify(error, 0, 2)
  document.body.innerHTML = `<pre style="color: red;">${data}</pre>`
}

const id = 'demo'
var counter = 1

function demo (default_theme = 'darkTheme', default_contract = 'SimpleStorage.sol') {
  const name = `${id}/${counter++}`
  const vars = selectTheme(default_theme)
  const css = classes
  const themes = selectTheme.names
  const list = contracts()
  const send = {}

  var _scui
  const el = bel`<div class=${css.demo}>
    <header class=${css.header}>
      <h1> demo smartcontract-ui </h1>
      <div class=${css.menu}>
        ${makeSelector()}
        ${makeThemeSwitch({ data: { themes } }, protocolThemeSwitch)}
      </div>
    </header>
    ${_scui = bel`<div class=${css.scui}></div>`}
  </div>`
  function protocolThemeSwitch (notify) {
    send.themeswitcher = notify
    return msg => {
      console.log(`[${name}] receives:`, msg)
      const { type, body } = msg
      if (type == 'theme') {
        const name = localStorage['theme'] = body
        return send.smartcontractui({ type: 'theme', body: selectTheme(name) })
      }
    }
  }
  function protocolSmartcontractUI (notify) {
    send.smartcontractui = notify
    return msg => {
      console.log(`[${name}] receives:`, msg)
      // @NOTE: maybe accept and do something with messages from smartcontract-ui
    }
  }

  updateTheme(vars)
  load(default_contract)
  document.body.appendChild(el)

  function makeSelector () {
    const isDefault = item => (item === default_contract) ? 'selected': ''
    return bel`
    <select class=${css.select} onchange=${event => load(event.target.value)}>
      ${list.map(item => bel`<option value=${item} ${isDefault(item)}>
        ${item}
      </option>`)}
    </select>`
  }
  async function load (contract) {
    localStorage['contract'] = contract
    const loading = bel`<div style="display: grid; justify-content: center; align-content: center; height: 100%;">...loading...</div>`
    _scui.innerHTML = ''
    _scui.appendChild(loading)
    try {
      const sourcecode = contracts(contract)
      const version = await getversion(sourcecode)
      const compiler = await solcjs(version)
      const data = await compiler(sourcecode)
      const opts = { data, theme: { variables: vars } }
      const form = smartcontractui(opts, protocolSmartcontractUI)
      _scui.innerHTML = ''
      _scui.appendChild(form)
    } catch (error) {
      console.error(error)
      _scui.innerHTML = ''
      const stack = error.stack || JSON.stringify(error, 0, 2)
      const data = JSON.stringify(stack.split('\n'), 0, 2)
      _scui.appendChild(bel`<pre style="color:red">${data}</pre>`)
    }
  }
  function updateTheme (vars) {
    Object.keys(variables).forEach(name => {
      document.body.style.setProperty(`--${name}`, vars[name])
    })
  }
}
const variables = {
  bodyBackgroundColor: '',
  bodyFont: '',
  bodyFontSize: '',
  bodyTextColor: '',
}
const classes = csjs`
html {
  font-size: 62.5%;
}
body {
  margin: 0;
  background-color: var(--bodyBackgroundColor);
  font-family: var(--bodyFont);
  font-size: var(--bodyFontSize);
  color: var(--bodyTextColor);
}
h1, h2, h3, h4, h5, h6 {
  margin: 0;
}
button {
  border: none;
  background: none;
  outline: none;
}
.header {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 99;
  width: calc(100% - 20px);
  padding: 0 10px;
  border-bottom: 1px solid rgba(255,255,255, .15);
  background-color: var(--bodyBackgroundColor);
}
.menu {
  display: grid;
  grid-template: auto / 50% 50%;
  align-items: center;
}
.select {
  width: 20%;
}
.scui {
  margin-top: 72px;
  height: calc(100vh - 72px)
}
.demo {
  box-sizing: border-box;
}`
