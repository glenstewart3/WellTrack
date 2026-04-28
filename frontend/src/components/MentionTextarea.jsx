import React, { useState, useRef, useCallback, useEffect } from 'react';
import { User } from 'lucide-react';

/**
 * MentionTextarea - A textarea with @mention autocomplete support
 */
export function MentionTextarea({
  value,
  onChange,
  users = [],
  placeholder = "Type @ to mention staff...",
  rows = 4,
  className = ""
}) {
  const textareaRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const dropdownRef = useRef(null);

  // Filter users based on search query
  const filteredUsers = users.filter(u => {
    const name = u.name || u.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  }).slice(0, 5); // Limit to 5 results

  // Handle input changes
  const handleInput = useCallback((e) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart;

    onChange(newValue);
    setCursorPosition(newCursorPosition);

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, newCursorPosition);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (mentionMatch) {
      setSearchQuery(mentionMatch[1]);
      setMentionStartIndex(newCursorPosition - mentionMatch[0].length);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
      setSearchQuery('');
      setMentionStartIndex(-1);
    }
  }, [onChange]);

  // Handle selecting a user from dropdown
  const selectUser = useCallback((user) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = value.slice(0, mentionStartIndex);
    const afterMention = value.slice(cursorPosition);
    const userName = user.name || user.email;
    const newValue = `${beforeMention}@${userName} ${afterMention}`;

    onChange(newValue);
    setShowDropdown(false);
    setSearchQuery('');
    setMentionStartIndex(-1);

    // Focus back to textarea and set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = beforeMention.length + userName.length + 2; // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [value, cursorPosition, mentionStartIndex, onChange]);

  // Handle keyboard navigation in dropdown
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handleKeyDown = useCallback((e) => {
    if (!showDropdown || filteredUsers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectUser(filteredUsers[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }, [showDropdown, filteredUsers, selectedIndex, selectUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          textareaRef.current && !textareaRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dropdown position
  const [dropdownStyle, setDropdownStyle] = useState({});

  useEffect(() => {
    if (showDropdown && textareaRef.current) {
      const textarea = textareaRef.current;
      const rect = textarea.getBoundingClientRect();

      // Approximate cursor position (simplified)
      const lineHeight = 20; // approximate line height
      const charsPerLine = Math.floor(rect.width / 8); // approximate chars per line
      const linesBeforeCursor = Math.floor(mentionStartIndex / charsPerLine);

      setDropdownStyle({
        position: 'absolute',
        left: '12px',
        top: `${Math.min(linesBeforeCursor * lineHeight + 40, rect.height - 10)}px`,
        zIndex: 50,
      });
    }
  }, [showDropdown, mentionStartIndex]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none ${className}`}
      />

      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-1 min-w-[200px] max-w-[280px]"
          style={dropdownStyle}
        >
          <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-100">
            Mention staff member
          </div>
          {filteredUsers.map((user, index) => (
            <button
              key={user.user_id || user.email || index}
              onClick={() => selectUser(user)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                index === selectedIndex ? 'bg-slate-100' : ''
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <User size={12} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {user.name || user.email}
                </p>
                {user.role && (
                  <p className="text-xs text-slate-400 capitalize">{user.role}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && searchQuery && filteredUsers.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute bg-white border border-slate-200 rounded-lg shadow-lg mt-1 py-2 px-3 min-w-[200px]"
          style={dropdownStyle}
        >
          <p className="text-sm text-slate-400">No matching staff found</p>
        </div>
      )}
    </div>
  );
}

export default MentionTextarea;
