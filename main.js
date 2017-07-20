const date = Date().slice(4, 15)

let width
let height
let halfWidth
let margin
let triangleA
let triangleB
let triangleC
let vertices
let r = g = b = 0
let mouseDown = false
let token = window.localStorage.getItem('token')
let currentData = window.localStorage.getItem('trilog')

/**
 * Set up canvas for retina
 */
const canvas = document.getElementById('triangle')
const ctx = canvas.getContext('2d')

/**
 * Functions
 */
const init = () => {
  // Retina quality
  canvas.width = canvas.height = window.innerWidth * 1.5
  canvas.style.width = canvas.style.height = canvas.width / 2 + 'px'
  ctx.scale(2, 2)

  // Draw the first triangle
  drawTriangle()
  drawDot({ x: halfWidth + margin, y: halfWidth + margin })

  // Set up API
  if (!token || token === '' || token === 'null') {
    token = window.prompt('API token')
    window.localStorage.setItem('token', token)
  }

  // Set up the previous data
  sync()
  visualize()
}

const color = (p1, p2, pos) => {
  // Distance from point to line
  const distance = Math.abs(
    (p2.y - p1.y) * pos.x -
    (p2.x - p1.x) * pos.y +
    p2.x * p1.y - p2.y * p1.x
  ) / Math.sqrt(
    Math.pow(p2.y - p1.y, 2) +
    Math.pow(p2.x - p1.x, 2)
  )

  // Map to 0-255
  if (distance < 0) return 0
  if (distance > height) return 255
  return Math.floor(distance * 255 / height)
}

const drawTriangle = () => {
  // Set up dimensions
  width = canvas.width * 0.9 / 2
  height = width * (Math.sqrt(3)/2)
  halfWidth = width / 2
  margin = canvas.width * 0.1 / 4

  // Store coordinates
  triangleA = {
    x: halfWidth + margin,
    y: margin,
  }
  triangleB = {
    x: width + margin,
    y: height + margin,
  }
  triangleC = {
    x: margin,
    y: height + margin,
  }
  vertices = {
    'A': triangleA,
    'T': triangleB,
    'N': triangleC,
  }

  // Draw the shape
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(triangleA.x, triangleA.y)
  ctx.lineTo(triangleB.x, triangleB.y)
  ctx.lineTo(triangleC.x, triangleC.y)
  ctx.fill()
  ctx.closePath()
}

const drawDot = ({x, y}) => {
  // Use given coordinates and current color
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
  ctx.beginPath()
  ctx.arc(x, y, width / 25, 0, Math.PI * 2, true)
  ctx.fill()
  ctx.closePath()
}

const getMousePosition = e => {
  // Touch position or mouse position
  const rect = canvas.getBoundingClientRect()
  const x = e.changedTouches ? e.changedTouches[0].pageX : e.clientX
  const y = e.changedTouches ? e.changedTouches[0].pageY : e.clientY

  return {
    x: x - rect.left,
    y: y - rect.top
  }
}

const inTriangle = pos => {
  // Complicated math that I'll never understand by http://blackpawn.com/texts/pointinpoly/default.html
  const v0 = [triangleC.x - triangleA.x, triangleC.y - triangleA.y]
  const v1 = [triangleB.x - triangleA.x, triangleB.y - triangleA.y]
  const v2 = [pos.x - triangleA.x, pos.y - triangleA.y]

  const dotProduct00 = (v0[0] * v0[0]) + (v0[1] * v0[1])
  const dotProduct01 = (v0[0] * v1[0]) + (v0[1] * v1[1])
  const dotProduct02 = (v0[0] * v2[0]) + (v0[1] * v2[1])
  const dotProduct11 = (v1[0] * v1[0]) + (v1[1] * v1[1])
  const dotProduct12 = (v1[0] * v2[0]) + (v1[1] * v2[1])

  const inverseDenominator = 1 / (dotProduct00 * dotProduct11 - dotProduct01 * dotProduct01)

  const u = (dotProduct11 * dotProduct02 - dotProduct01 * dotProduct12) * inverseDenominator
  const v = (dotProduct00 * dotProduct12 - dotProduct01 * dotProduct02) * inverseDenominator

  return (u >= 0) && (v >= 0) && (u + v < 1)
}

const clear = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawTriangle()
}

const calculate = e => {
  // No hover, only drag
  if (!mouseDown) return

  // Never place the dot outside the triangle
  const pos = getMousePosition(e)
  if (!inTriangle(pos)) return

  // Redraw
  clear()

  // Calculate balance
  r = color(triangleC, triangleB, pos)
  g = color(triangleB, triangleA, pos)
  b = color(triangleC, triangleA, pos)

  // Draw the dot
  drawDot(pos)
}

const sync = (submitting = false) => {
  const pull = new XMLHttpRequest()
  const push = new XMLHttpRequest()
  const connectionStatus = document.getElementById('connection-status')

  let stack = []

  if (submitting) {
    // Set up the object for this submission
    const submission = { r: r, g: g, b: b, date: date}

    // If there's already data, use that first
    if (currentData) {
      stack = JSON.parse(currentData)
    }

    // If there already was a submission today, replace it
    let latest = stack.length - 1
    if (stack[latest] && stack[latest].date === date) {
      stack[latest] = submission

    // Otherwise, push it onto the stack
    } else {
      stack.push(submission)
    }

    // Store locally
    currentData = JSON.stringify(stack)
    window.localStorage.setItem('trilog', currentData)
  }

  // Pull remote content
  pull.open('GET', `http://io.neufv.website/trilog?token=${token}`, true)
  pull.onreadystatechange = () => {
    if (pull.readyState === XMLHttpRequest.DONE) {
      // If remote content is different, or if we're submitting, overwrite with local data
      if (pull.responseText !== currentData || submitting) {
        // Prepare request
        push.open('POST', 'http://io.neufv.website/trilog', true)
        push.setRequestHeader("Content-type", "application/x-www-form-urlencoded")

        // Handle responses
        push.onreadystatechange = () => {
            if (pull.readyState == XMLHttpRequest.DONE && pull.status == 200) {
              // Show message for 5 seconds
              connectionStatus.innerHTML = 'Synced'
              setTimeout(() => { connectionStatus.innerHTML = '' }, 3000)
            } else {
              // Reset token
              connectionStatus.innerHTML = 'Error syncing'
              window.localStorage.setItem('token', '')
            }
        }

        // Send request
        push.send(`token=${token}&data=${currentData}`)
      }
    } else {
      connectionStatus.innerHTML = 'Offline'
    }
  }
  pull.send()
}

const visualize = () => {
  const colorBar = document.getElementById('color-bar')
  let stack = []
  colorBar.innerHTML = ''

  if (currentData) {
    stack = JSON.parse(currentData)
    stack.forEach(node => {
      const colorBlock = document.createElement('div')
      colorBlock.style.backgroundColor = `rgb(${node.r}, ${node.g}, ${node.b})`
      colorBar.appendChild(colorBlock)
    })
  }
}

/**
 * Triangle manipulators
 */
canvas.addEventListener('mousedown', e => {
  mouseDown = true
  calculate(e)
})
canvas.addEventListener('touchstart', e => {
  mouseDown = true
})
canvas.addEventListener('mouseup', () => {
  mouseDown = false
})
canvas.addEventListener('mousemove', calculate)
canvas.addEventListener('touchmove', calculate)

/**
 * Buttons
 */
document.getElementById('submit-button').addEventListener('click', () => {
  sync(true)
  visualize()
})

document.querySelectorAll('.corner-button')
  .forEach(element => element.addEventListener('click', () => {
    const vertice = element.innerHTML

    r = vertice === 'A' ? 255 : 0
    g = vertice === 'N' ? 255 : 0
    b = vertice === 'T' ? 255 : 0

    clear()
    drawDot(vertices[vertice])
  }))
window.addEventListener('resize', init)

/**
 * Disable iOS zooming
 */
let lastTouchEvent = 0

document.addEventListener('touchmove', e => {
  e.preventDefault()
}, { passive: false })

document.addEventListener('gesturestart', e => { e.preventDefault() }, { passive: false})

document.addEventListener('touchstart', e => {
 if (e.timeStamp - lastTouchEvent <= 300 || e.touches.length > 1) {
   e.preventDefault()
 }
 lastTouchEvent = e.timeStamp
}, { passive: false})

/**
 * Initialize
 */
document.getElementById('date').innerHTML = date
init()
