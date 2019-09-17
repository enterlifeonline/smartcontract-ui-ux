const bel = require('bel')
const csjs = require('csjs-inject')
const solcjs = require('solc-js')

const getversion = require('get-compiler-version')
const contracts = require('contracts')
const smartcontractapp = require('../')

;(async () => { // init
  const parser = document.createElement('div')
  const select = await solcjs.versions().catch(onerror)
  const { all } = select
  demo(parser, sourcecode => getversion(all, sourcecode))
  function onerror (error) {
    document.body.innerHTML = `<pre style="color:red">
      ${JSON.stringify(error, null, 2)}
    </pre>`
  }
})()

function demo (parser, getversion, onerror) {
  const list = contracts()

  const selector = bel`<select class=${css.select}>
    ${list.map(item => bel`<option value=${item}>${item}</option>`)}
  </select>`
  selector.onchange = show
  const scui = bel`<div class=${css.scui}></div>`

  document.body.appendChild(bel`<div class=${css.demo}>
    <h1> demo smartcontract-ui </h1>
    ${selector}
    ${scui}
  </div>`)

  show({ target: { value: list[0] } })

  async function show (event) {
    scui.innerHTML = '...loading...'
    const name = event.target.value
    const sourcecode = contracts(name)
    const version = getversion(sourcecode)
    const compiler = await solcjs(version).catch(onerror)
    const result = await compiler(sourcecode).catch(onerror)
    const form = smartcontractapp(result)
    scui.innerHTML = ''
    scui.appendChild(form)
  }
}
const css = csjs`
.select {
  width: 20%;
}
.scui {
  border: 1px dashed green;
  flex-grow: 1;
  margin: 5px;
  align-items: center;
  justify-content: center;
  display: flex;
}
.demo {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}
`

