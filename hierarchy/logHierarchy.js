function traverseFiber(fiberNode, depth = 0, hierarchy = '') {
  let componentName = '';
  let isComponentAnonymous = false;

  if (fiberNode.type) {
    componentName = fiberNode.type.name || fiberNode.type.displayName;
    isComponentAnonymous = !componentName;
    componentName = componentName || 'Anonymous';
  } else if (fiberNode.elementType && fiberNode.elementType.name) {
    componentName = fiberNode.elementType.name;
  } else {
    isComponentAnonymous = true;
  }

  const line = isComponentAnonymous
    ? ''
    : `${' '.repeat(depth * 2)}${componentName}\n`;

  if (!isComponentAnonymous) {
    hierarchy += line;
    console.log(line.trim());
  }

  const nextDepth = isComponentAnonymous ? depth : depth + 1;

  if (fiberNode.child) {
    hierarchy = traverseFiber(fiberNode.child, nextDepth, hierarchy);
  }
  if (fiberNode.sibling) {
    hierarchy = traverseFiber(fiberNode.sibling, depth, hierarchy);
  }

  return hierarchy;
}

function findReactRootContainer(domElement) {
  const keys = Object.keys(domElement);
  for (let key of keys) {
    if (
      key.startsWith('__reactContainer$') ||
      key.startsWith('__reactFiber$')
    ) {
      return domElement[key];
    }
  }
  return null;
}
function downloadHierarchy(hierarchy) {
  const blob = new Blob([hierarchy], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'component-hierarchy.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function logComponentHierarchy() {
  const rootDOMElement = document.getElementById('root');
  const rootContainerProperty = findReactRootContainer(rootDOMElement);
  if (!rootContainerProperty) {
    console.error('React root container not found.');
    return;
  }

  const rootFiber = rootContainerProperty.current || rootContainerProperty;
  if (!rootFiber) {
    console.error(
      'Root fiber not found. Make sure your app is rendered and you are using the correct container ID.'
    );
    return;
  }

  const hierarchy = traverseFiber(rootFiber);
  downloadHierarchy(hierarchy);
}

logComponentHierarchy();
