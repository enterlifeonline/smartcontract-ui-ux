const bel = require('bel')
const csjs = require('csjs-inject')
const solcjs = require('solc-js')

const selectTheme = require('theme')
const themeSwitcher = require('theme-switcher')
const getversion = require('get-compiler-version')
const contracts = require('contracts')
const smartcontractui = require('../')

try {
  setTimeout(demo, 0) // start demo in the next tick so all code can initialize first
} catch (error) {
  const data = JSON.stringify(error, 0, 2)
  document.body.innerHTML = `<pre style="color: red;">${data}</pre>`
}

const id = 'demo'
var counter = 1

function demo (default_theme = 'darkTheme', default_contract = 'SimpleStorage.sol') {
  const name = `${id}/${counter++}`

  const vars = selectTheme(default_theme)
  const css = classes
  const list = contracts()

  const send = {}
  
  const opts = { theme: selectTheme, init: default_theme }
  const switcher = themeSwitcher(opts, notify => {
    send.themeswitcher = notify
    return msg => {
      console.log(`[${name}] receives:`, msg)
      const { type, body } = msg
      if (type == 'theme') return send.smartcontractui({ type: 'theme', body })
    }
  })

  const scui = bel`<div class=${css.scui}></div>`

  const selector = bel`<select class=${css.select}>
    ${list.map(item => bel`<option value=${item} ${(item === default_contract) ? 'selected': ''}>
      ${item}
    </option>`)}
  </select>`
  selector.onchange = event => load(event.target.value)

  const el = bel`<div class=${css.demo}>
    <h1> demo smartcontract-ui </h1>
    <div class=${css.menu}>${selector}${switcher}</div>
    ${scui}
  </div>`

  updateTheme(vars)
  load(default_contract)
  document.body.appendChild(el)

  async function load (contract) {
    scui.innerHTML = '...loading...'
    try {
      const sourcecode = contracts(contract)
      const version = await getversion(sourcecode)
      const compiler = await solcjs(version)
      const data = await compiler(sourcecode)
      const form = smartcontractui({ data, theme: { variables: vars } }, notify => {
        send.smartcontractui = notify
        return msg => {
          console.log(`[${name}] receives:`, msg)
        }
      })
      scui.innerHTML = ''
      scui.appendChild(form)
    } catch (error) {
      scui.innerHTML = ''
      const data = JSON.stringify(error, 0, 2)
      scui.appendChild(bel`<pre style="color:red">${data}</pre>`)
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
.menu {
  margin: 0;
}
.select {
  width: 20%;
}
.scui {
  border-top: 1px dashed white;
  flex-grow: 1;
  margin: 5px;
  align-items: top;
  justify-content: center;
  display: flex;
}
.demo {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}`