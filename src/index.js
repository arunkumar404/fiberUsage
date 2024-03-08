const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const stateManager = require('./utils/stateManager');
const logger = require('./utils/logger');
const { ERROR_MESSAGES } = require('./constants/constants');
const generator = require('@babel/generator').default;
const prettier = require('prettier');
const { v4: uuidv4 } = require('uuid');

const readSourceCode = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file: ${filePath}`, error);
    return null;
  }
};

const parseToAST = (sourceCode) => {
  try {
    return parser.parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
  } catch (error) {
    console.error('Error parsing source code', error);
    return null;
  }
};

const generateCodeFromAST = (ast, originalCode) =>
  generator(ast, {}, originalCode).code;

const createJSXAttribute = (name, value) => {
  let attributeValue;

  if (name === 'pc_comp_ref_id' && value === 'pc_el_id') {
    attributeValue = {
      type: 'JSXExpressionContainer',
      expression: {
        type: 'Identifier',
        name: value, 
      },
    };
  } else if (value.startsWith('props.')) {
    attributeValue = {
      type: 'JSXExpressionContainer',
      expression: {
        type: 'MemberExpression',
        computed: false,
        object: { type: 'Identifier', name: 'props' },
        property: { type: 'Identifier', name: value.substring(6) },
      },
    };
  } else {
    attributeValue = { type: 'StringLiteral', value };
  }

  return {
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name },
    value: attributeValue,
  };
};


const ensurePropsParameter = (functionPath) => {
  const params = functionPath.node.params;
  let propHandlingMethod = 'none'; 

  const hasDestructuredProps = params.some(
    (param) => param.type === 'ObjectPattern'
  );

  if (hasDestructuredProps) {
    const destructuredIndex = params.findIndex(
      (param) => param.type === 'ObjectPattern'
    );
    const properties = params[destructuredIndex].properties;
    const hasPcElId = properties.some(
      (prop) => prop.key && prop.key.name === 'pc_el_id'
    );

    if (!hasPcElId) {
      properties.push({
        type: 'ObjectProperty',
        key: { type: 'Identifier', name: 'pc_el_id' },
        value: { type: 'Identifier', name: 'pc_el_id' },
        shorthand: true,
      });
    }
    propHandlingMethod = 'destructured';
  } else {
    if (params.length && params.find((param) => param.name === 'props')) {
      propHandlingMethod = 'props';
    } else {
      params.unshift({
        type: 'Identifier',
        name: 'props',
      });
      propHandlingMethod = 'props';
    }
  }

  return propHandlingMethod;
};


const injectPropsAndAttributes = (path, componentName) => {
  let functionPath = null;
  if (
    [
      'FunctionDeclaration',
      'ArrowFunctionExpression',
      'FunctionExpression',
    ].includes(path.node.type)
  ) {
    functionPath = path;
  } else if (
    path.node.type === 'VariableDeclarator' &&
    path.node.init &&
    ['ArrowFunctionExpression', 'FunctionExpression'].includes(
      path.node.init.type
    )
  ) {
    functionPath = path.get('init');
  }

  let propHandlingMethod = 'none';
  if (functionPath) {
    propHandlingMethod = ensurePropsParameter(functionPath);
  }

  let rootElementProcessed = false;
  functionPath.traverse({
    JSXOpeningElement(jsxPath) {
      const alreadyHasPcElId = jsxPath.node.attributes.some(
        (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'pc_el_id'
      );

      if (!alreadyHasPcElId) {
        const uniqueId = `unique_id_${Math.random().toString(16).slice(2, 18)}`;
        jsxPath.node.attributes.push(createJSXAttribute('pc_el_id', uniqueId));
      }

      if (!rootElementProcessed) {
        const pcCompRefIdValue =
          propHandlingMethod === 'destructured' ? 'pc_el_id' : 'props.pc_el_id';
        jsxPath.node.attributes.push(
          createJSXAttribute('pc_comp_name', componentName)
        );
        jsxPath.node.attributes.push(
          createJSXAttribute('pc_comp_ref_id', pcCompRefIdValue)
        );
        rootElementProcessed = true;
      }
    },
  });
};



const findFileInStructure = (structure, filePath) => {
  let result = null;

  const search = (items, path) => {
    for (let item of items) {
      if (item.fullPath === path) {
        result = item;
        return;
      }
      if (item.type === 'directory' && item.children) {
        search(item.children, path);
      }
      if (result) return;
    }
  };

  search(structure, filePath);
  return result;
};

const addComponentNameToRoot = (ast, filePath, structure) => {
  const fileItem = findFileInStructure(structure, filePath);
  const componentsInFile = fileItem?.definedComponents || [];
  traverse(ast, {
    FunctionDeclaration(path) {
      if (
        componentsInFile.some((component) => {
          console.log(component);
          return component.name === path.node.id?.name;
        })
      ) {

        injectPropsAndAttributes(path, path.node.id?.name);
      }
    },
    VariableDeclarator(path) {
      if (
        (path.node.init?.type === 'ArrowFunctionExpression' ||
          path.node.init?.type === 'FunctionExpression') &&
        componentsInFile.some((component) => {
          return component.name === path.node.id?.name;
        })
      ) {
        injectPropsAndAttributes(path, path.node.id?.name);
      }
    },
  });
};

const addUniqueIdToElements = (ast) => {
  traverse(ast, {
    JSXOpeningElement(path) {
      const uniqueId = uuidv4().replace(/-/g, '').substring(0, 16);
      const elementIdAttr = createJSXAttribute('pc_el_id', uniqueId);
      path.node.attributes.push(elementIdAttr);
    },
  });
};

const writeToFile = (filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf-8');
};

const processFile = async (sourcePath, targetPath) => {
  const sourceCode = readSourceCode(sourcePath);
  if (!sourceCode) return;

  const ast = parseToAST(sourceCode);
  if (!ast) return;

  addUniqueIdToElements(ast);
  addComponentNameToRoot(
    ast,
    path.relative(originalProjectPath, sourcePath),
    stateManager.getProjectStructure()
  );

  const modifiedCode = generateCodeFromAST(ast, sourceCode);
  const prettierConfig = JSON.parse(fs.readFileSync('.prettierrc', 'utf8'));
  const formattedCode = await prettier.format(modifiedCode, {
    ...prettierConfig,
    parser: 'babel',
  });

  writeToFile(targetPath, formattedCode);
};

const createProjectStructure = (structure, sourceBase, targetBase) => {
  structure.forEach((item) => {
    const sourcePath = path.join(sourceBase, item.name);
    const targetPath = path.join(targetBase, item.name);

    if (item.type === 'file') {
      const shouldProcess = item.process && item.containsJSX;
      if (shouldProcess) {
        processFile(sourcePath, targetPath).then(() => {
          logger.info(`Processed and copied: ${sourcePath} to ${targetPath}`);
        });
      } else {
        fs.copyFileSync(sourcePath, targetPath);
        logger.info(`Copied: ${sourcePath} to ${targetPath}`);
      }
    } else if (item.type === 'directory') {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      createProjectStructure(item.children, sourcePath, targetPath);
    }
  });
};

const containsJSX = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    let hasJSX = false;
    traverse(ast, {
      JSXElement() {
        hasJSX = true;
      },
    });
    return hasJSX;
  } catch (error) {
    logger.error(`${ERROR_MESSAGES.PARSING_FILE_ERROR} ${filePath}: ${error}`);
    return false;
  }
};

const containsReactRoot = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    let hasReactRoot = false;
    traverse(ast, {
      CallExpression(path) {
        if (
          path.node.callee.object &&
          path.node.callee.object.name === 'ReactDOM' &&
          path.node.callee.property &&
          path.node.callee.property.name === 'createRoot'
        ) {
          hasReactRoot = true;
        }
      },
    });
    if (hasReactRoot) {
      let rootFiles = stateManager.get('rootFiles') || [];
      rootFiles.push(filePath);
      stateManager.set('rootFiles', rootFiles);
    }
    return hasReactRoot;
  } catch (error) {
    logger.error(`${ERROR_MESSAGES.PARSING_FILE_ERROR} ${filePath}: ${error}`);
    return false;
  }
};

const functionReturnsJSX = (path) => {
  let returnsJSX = false;
  path.traverse({
    ReturnStatement(returnPath) {
      if (
        returnPath.node.argument &&
        ['JSXElement', 'JSXFragment'].includes(returnPath.node.argument.type)
      ) {
        returnsJSX = true;
      }
    },
    ArrowFunctionExpression(arrowPath) {
      if (['JSXElement', 'JSXFragment'].includes(arrowPath.node.body.type)) {
        returnsJSX = true;
      }
    },
  });
  return returnsJSX;
};

const analyzeComponents = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const definedComponents = [];
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'classProperties',
        'exportDefaultFrom',
        'exportNamespaceFrom',
      ],
    });
    traverse(ast, {
      ClassDeclaration(path) {
        if (
          path.node.superClass &&
          ['Component', 'PureComponent'].includes(path.node.superClass.name)
        ) {
          const componentName = path.node.id?.name || 'UnknownClassComponent';
          definedComponents.push({
            name: componentName,
            type: 'class',
            isDefaultExport: false,
            isNamedExport: false,
          });
        }
      },
      FunctionDeclaration(path) {
        if (functionReturnsJSX(path)) {
          const componentName =
            path.node.id?.name || 'UnknownFunctionComponent';
          definedComponents.push({
            name: componentName,
            type: 'functional',
            isDefaultExport: false,
            isNamedExport: false,
          });
        }
      },
      VariableDeclaration(path) {
        path.traverse({
          ArrowFunctionExpression(path) {
            if (functionReturnsJSX(path)) {
              const componentName =
                path.parent.id?.name || 'UnknownFunctionalComponent';
              definedComponents.push({
                name: componentName,
                type: 'functional',
                isDefaultExport: false,
                isNamedExport: false,
              });
            }
          },
          FunctionExpression(path) {
            if (functionReturnsJSX(path)) {
              const componentName =
                path.parent.id?.name || 'UnknownFunctionalComponent';
              definedComponents.push({
                name: componentName,
                type: 'functional',
                isDefaultExport: false,
                isNamedExport: false,
              });
            }
          },
        });
      },
      CallExpression(path) {
        if (
          path.node.callee.name === 'forwardRef' ||
          (path.node.callee.object?.name === 'React' &&
            ['forwardRef', 'memo'].includes(path.node.callee.property?.name))
        ) {
          let componentName = path.parentPath.node.id
            ? path.parentPath.node.id.name
            : 'UnknownHOCComponent';
          definedComponents.push({
            name: componentName,
            type: 'functional',
            isDefaultExport: false,
            isNamedExport: false,
            wrappedIn: path.node.callee.property?.name || 'forwardRef',
          });
        }
      },
      ExportDefaultDeclaration(path) {
        let defaultExportName = null;
        if (path.node.declaration.type === 'Identifier') {
          defaultExportName = path.node.declaration.name;
        } else if (
          ['FunctionDeclaration', 'ClassDeclaration'].includes(
            path.node.declaration.type
          ) &&
          path.node.declaration.id
        ) {
          defaultExportName = path.node.declaration.id.name;
        }
        if (defaultExportName) {
          definedComponents.forEach((component) => {
            if (component.name === defaultExportName) {
              component.isDefaultExport = true;
            }
          });
        }
      },
      ExportNamedDeclaration(path) {
        path.node.specifiers.forEach((specifier) => {
          if (specifier.type === 'ExportSpecifier') {
            const exportedName = specifier.exported.name;
            definedComponents.forEach((component) => {
              if (component.name === exportedName) {
                component.isNamedExport = true;
              }
            });
          }
        });
      },
    });
  } catch (error) {
    logger.error(
      `${ERROR_MESSAGES.ANALYZING_COMPONENTS_ERROR} ${filePath}: ${error}`
    );
  }
  return definedComponents;
};

const getProjectStructure = (dirPath, originalProjectPath) => {
  let structure = [];
  const items = fs.readdirSync(dirPath);

  items.forEach((item) => {
    if (item.startsWith('.')) return;
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!['node_modules', '.git', '.next'].includes(item)) {
        structure.push({
          type: 'directory',
          name: item,
          children: getProjectStructure(fullPath, originalProjectPath)
            .structure,
        });
      }
    } else {
      const isJSXFile = /\.(jsx|js)$/.test(item);
      const containsJSXBool = isJSXFile ? containsJSX(fullPath) : false;
      let fileStructure = {
        type: 'file',
        name: item,
        process: isJSXFile,
        containsJSX: containsJSXBool,
        fullPath: path.relative(originalProjectPath, fullPath),
      };

      if (isJSXFile && containsReactRoot(fullPath)) {
        fileStructure['containsReactRoot'] = true;
      }

      if (containsJSXBool) {
        const definedComponents = analyzeComponents(fullPath);
        if (definedComponents.length > 0) {
          fileStructure['definedComponents'] = definedComponents;
        }
      }

      structure.push(fileStructure);
    }
  });

  return { structure };
};

const originalProjectPath = '/home/arun/Desktop/extremes';
const newProjectPath = `${originalProjectPath}_new`;
const structureOutputPath = path.join('./', 'structure.json');

const { structure: projectStructure } = getProjectStructure(
  originalProjectPath,
  originalProjectPath
);

stateManager.set('projectStructure', projectStructure);

fs.writeFileSync(
  structureOutputPath,
  JSON.stringify(projectStructure, null, 2),
  'utf-8'
);
logger.info('Project structure has been successfully captured.');

if (!fs.existsSync(newProjectPath)) {
  fs.mkdirSync(newProjectPath, { recursive: true });
}

createProjectStructure(projectStructure, originalProjectPath, newProjectPath);
