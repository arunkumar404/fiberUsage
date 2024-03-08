class StateManager {
  constructor() {
    this.state = {
      projectStructure: [],
      rootFiles: [],
    }
  }

  set(key, value) {
    this.state[key] = value
  }

  get(key) {
    return this.state[key]
  }

  remove(key) {
    delete this.state[key]
  }

  update(key, value) {
    if (key in this.state) {
      this.state[key] = value
    } else {
      console.warn(`Key "${key}" not found in state.`)
    }
  }

  clear() {
    this.state = {}
  }

  setProjectStructure(structure) {
    this.set('projectStructure', structure)
  }

  getProjectStructure() {
    return this.get('projectStructure')
  }

  setRootFiles(files) {
    this.set('rootFiles', files)
  }

  getRootFiles() {
    return this.get('rootFiles')
  }
}

module.exports = new StateManager()
