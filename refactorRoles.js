const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // Replace enum values
  content = content.replace(/USER_ROLES\.SUPER_ADMIN/g, 'USER_ROLES.ADMIN');
  content = content.replace(/USER_ROLES\.BROTHER/g, 'USER_ROLES.USER');
  content = content.replace(/USER_ROLES\.SISTER/g, 'USER_ROLES.USER');
  content = content.replace(/USER_ROLES\.JUMMAH/g, 'USER_ROLES.USER');
  
  content = content.replace(/USER_STATUS\.DELETE/g, "USER_STATUS.DELETED");

  // Clean up duplicated roles in auth(...) and z.enum([...])
  // auth(USER_ROLES.ADMIN, USER_ROLES.USER, USER_ROLES.USER, USER_ROLES.USER) -> auth(USER_ROLES.ADMIN, USER_ROLES.USER)
  // This can be tricky due to newlines. Let's do it with a custom replacer.

  const replaceDuplicatedRoles = (match, prefix, inner, suffix) => {
    // extract unique roles
    const roles = inner.match(/USER_ROLES\.[A-Z_]+/g);
    if (!roles) return match;
    const uniqueRoles = [...new Set(roles)];
    return `${prefix}${uniqueRoles.join(', ')}${suffix}`;
  };

  // Match auth(...) across multiple lines
  content = content.replace(/(auth\()([\s\S]*?)(\))/g, replaceDuplicatedRoles);

  // Match z.enum([...]) across multiple lines
  content = content.replace(/(z\.enum\(\[)([\s\S]*?)(\])/g, replaceDuplicatedRoles);
  
  // Match arrays like [USER_ROLES.USER, USER_ROLES.USER]
  content = content.replace(/(\[)([\s\n]*(?:USER_ROLES\.(?:USER|ADMIN))[\s\n]*,?[\s\n]*)+(\])/g, (match) => {
     const roles = match.match(/USER_ROLES\.[A-Z_]+/g);
     if (!roles) return match;
     const uniqueRoles = [...new Set(roles)];
     return `[${uniqueRoles.join(', ')}]`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir('d:\\Khaled\\re-factor\\stayhide\\src');
console.log('Done refactoring roles.');
