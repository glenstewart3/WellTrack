// Sort classes: Foundation first, then numeric (F, 1/2, 3/4, 5/6)
export const sortClasses = (classes) => {
  if (!classes || !Array.isArray(classes)) return [];
  
  return [...classes].sort((a, b) => {
    const aName = (a.class_name || a.name || '').toString();
    const bName = (b.class_name || b.name || '').toString();
    
    // Foundation (F) comes first
    if (aName.startsWith('F') && !bName.startsWith('F')) return -1;
    if (!aName.startsWith('F') && bName.startsWith('F')) return 1;
    
    // Both start with F or both don't - extract first number
    const aMatch = aName.match(/(\d+)/);
    const bMatch = bName.match(/(\d+)/);
    const aNum = aMatch ? parseInt(aMatch[1]) : 99;
    const bNum = bMatch ? parseInt(bMatch[1]) : 99;
    
    return aNum - bNum;
  });
};

// Sort array of class name strings
export const sortClassNames = (classNames) => {
  if (!classNames || !Array.isArray(classNames)) return [];
  
  return [...classNames].sort((a, b) => {
    const aName = String(a);
    const bName = String(b);
    
    // Foundation (F) comes first
    if (aName.startsWith('F') && !bName.startsWith('F')) return -1;
    if (!aName.startsWith('F') && bName.startsWith('F')) return 1;
    
    // Both start with F or both don't - extract first number
    const aMatch = aName.match(/(\d+)/);
    const bMatch = bName.match(/(\d+)/);
    const aNum = aMatch ? parseInt(aMatch[1]) : 99;
    const bNum = bMatch ? parseInt(bMatch[1]) : 99;
    
    return aNum - bNum;
  });
};
