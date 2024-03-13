let boundingBoxes = [];

function findDOMNode(fiberNode) {
  let node = fiberNode;
  while (node) {
    if (node.stateNode instanceof HTMLElement) return node.stateNode;
    node = node.child || (node.alternate ? node.alternate.child : null);
  }
  return null;
}

function traverseFiber(fiberNode, depth = 0, hierarchy = '', parentObject = null) {
    let componentName = '';
    let isComponentAnonymous = false;
    let nodeObject = null;

    if (fiberNode.type) {
      componentName = fiberNode.type.name || fiberNode.type.displayName;
      isComponentAnonymous = !componentName;
      componentName = componentName || 'Anonymous';
    } else if (fiberNode.elementType && fiberNode.elementType.name) {
      componentName = fiberNode.elementType.name;
    } else {
      isComponentAnonymous = true;
    }
    
  let boundingBox = {}
    if (!isComponentAnonymous) {
        const domNode = findDOMNode(fiberNode);
        if (domNode) {
            const rect = domNode.getBoundingClientRect();
            boundingBox = {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            };

            boundingBoxes.push({
                componentName,
                ...boundingBox
            });

          }
        }
        if ( !isComponentAnonymous ) {
          
          nodeObject = {
              name: componentName,
              boundingBox,
              children: []
          };
      
          if (parentObject) {
              parentObject.children.push(nodeObject);
          }
  }

    if (depth === 0 && !parentObject) {
        parentObject = nodeObject || { name: componentName || 'Root', boundingBox: {}, children: [] };
    }

    const line = isComponentAnonymous ? '' : `${' '.repeat(depth * 2)}${componentName}\n`;
    hierarchy += line;

    const nextDepth = isComponentAnonymous ? depth : depth + 1;
    let childToProcess = fiberNode.child;
    if (childToProcess) {
        hierarchy = traverseFiber(childToProcess, nextDepth, hierarchy, nodeObject || parentObject);
    }
    if (fiberNode.sibling) {
        hierarchy = traverseFiber(fiberNode.sibling, depth, hierarchy, parentObject);
    }

    if (depth === 0) {
        return { hierarchy, rootObject: parentObject };
    }

    return hierarchy;
}




function downloadJSON(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  let rootDOMElement = document.getElementById('root');
  if (!rootDOMElement) {
    rootDOMElement = document.getElementById('__next');
  }

  if (!rootDOMElement) {
    console.error('React root container not found... ');
    return;
  }
  const rootContainerProperty = findReactRootContainer(rootDOMElement);
  if (!rootContainerProperty) {
    console.error('Root container not found');
    return;
  }

  const rootFiber = rootContainerProperty.current || rootContainerProperty;
  if (!rootFiber) {
    console.error('Root fiber not found');
    return;
  }
  console.log('outside-------------', rootFiber);
  boundingBoxes = [];
  const {hierarchy, rootObject} = traverseFiber( rootFiber );

  downloadHierarchy( hierarchy.hierarchy );
  downloadJSON(rootObject, 'nested-structure.json');

  downloadJSON(boundingBoxes, 'bounding-boxes.json');
}

logComponentHierarchy();
