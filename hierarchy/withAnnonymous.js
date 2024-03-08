let boundingBoxes = [];
let nestedHierarchy = {};

function findDOMNode(fiberNode) {
  let node = fiberNode;
  while (node) {
    if (node.stateNode instanceof HTMLElement) return node.stateNode;
    node = node.child || (node.alternate ? node.alternate.child : null);
  }
  return null;
}

function traverseFiber(
  fiberNode,
  depth = 0,
  hierarchy = '',
  parentHierarchyNode = null
) {
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
  }

  let currentHierarchyNode = {
    name: componentName,
    boundingBox: null,
    children: [],
  };

  const domNode = findDOMNode(fiberNode);
  if (domNode) {
    const rect = domNode.getBoundingClientRect();
    boundingBoxes.push({
      componentName,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    currentHierarchyNode.boundingBox = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  if (parentHierarchyNode) {
    parentHierarchyNode.children.push(currentHierarchyNode);
  } else {
    nestedHierarchy = currentHierarchyNode; 
  }

  const nextDepth = isComponentAnonymous ? depth : depth + 1;
  if (fiberNode.child) {
    traverseFiber(fiberNode.child, nextDepth, hierarchy, currentHierarchyNode);
  }
  if (fiberNode.sibling) {
    traverseFiber(fiberNode.sibling, depth, hierarchy, parentHierarchyNode);
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
  boundingBoxes = [];
  nestedHierarchy = {};

  const hierarchyText = traverseFiber(rootFiber);
  console.log(hierarchyText);
  downloadHierarchy(hierarchyText); 
  downloadJSON(boundingBoxes, 'bounding-boxes.json'); 
  downloadJSON(nestedHierarchy, 'nested-hierarchy-with-bounding-boxes.json'); 
}

logComponentHierarchy();
