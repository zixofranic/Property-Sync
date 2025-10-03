# Common Issues and Troubleshooting

## Quick Fixes

### Messages Not Sending
**Symptoms**: Messages appear stuck or don't deliver
**Solutions**:
1. Check your internet connection
2. Refresh the page (Ctrl+F5 or Cmd+Shift+R)
3. Clear browser cache and cookies
4. Try a different browser
5. Check if the recipient is online

### Property Photos Not Loading
**Symptoms**: Images show as broken or don't appear
**Solutions**:
1. Wait a moment for images to load
2. Refresh the page
3. Check internet connection speed
4. Try disabling ad blockers temporarily
5. Clear browser cache

### Login Issues
**Symptoms**: Can't sign in, password not accepted
**Solutions**:
1. Verify email and password are correct
2. Check Caps Lock is off
3. Try password reset if needed
4. Clear browser data
5. Contact administrator for account issues

## Platform-Specific Issues

### Real-Time Messaging Problems

#### Messages Appearing Twice (Known Issue)
**Description**: Messages may appear duplicated after page reload
**Temporary Workarounds**:
1. Don't refresh the page unless necessary
2. Use browser back/forward instead of reload
3. Close and reopen chat to reset state
**Status**: Under investigation

#### Chat Not Loading
**Solutions**:
1. Ensure WebSocket connection is active (check connection indicator)
2. Refresh the page to reestablish connection
3. Check browser console for error messages
4. Verify network isn't blocking WebSocket connections

### Property Search Issues

#### Search Results Not Updating
**Solutions**:
1. Clear search filters and try again
2. Check if location services are enabled
3. Verify search terms are spelled correctly
4. Try browsing without filters first

#### Map Not Loading
**Solutions**:
1. Enable location services in browser
2. Check if JavaScript is enabled
3. Try refreshing the page
4. Use list view as alternative

## Browser Compatibility

### Recommended Browsers
- **Chrome** 90+ (Recommended)
- **Firefox** 88+
- **Safari** 14+
- **Edge** 90+

### Browser Settings
Ensure these are enabled:
- **JavaScript**: Required for all platform features
- **Cookies**: Needed for login and preferences
- **Local Storage**: Used for temporary data
- **WebSocket**: Required for real-time messaging

## Mobile Issues

### Mobile Performance
If the platform is slow on mobile:
1. Close other apps to free memory
2. Check mobile data/WiFi connection
3. Update your mobile browser
4. Clear browser cache on mobile

### Touch Navigation Issues
**Solutions**:
1. Ensure screen is clean
2. Try landscape orientation for better visibility
3. Use zoom if text is too small
4. Restart the browser app

## Connection Issues

### Internet Connection Problems
**Symptoms**: Intermittent loading, timeouts
**Solutions**:
1. Test internet speed (aim for 5+ Mbps)
2. Switch between WiFi and mobile data
3. Restart your router/modem
4. Contact your ISP if problems persist

### VPN/Firewall Issues
If using VPN or corporate network:
1. Try disabling VPN temporarily
2. Contact IT about WebSocket connections
3. Ensure port 80/443 are open
4. Check for proxy settings

## Development Environment Issues

### Local Development Problems

#### API Server Won't Start
**Common Ports**: 3003 (API), 3001 (Web)
**Solutions**:
1. Check if ports are already in use: `netstat -ano | findstr :3003`
2. Kill conflicting processes
3. Use different port: `PORT=3004 npm run start:dev`
4. Check for missing dependencies: `npm install`

#### WebSocket Connection Failed
**Solutions**:
1. Verify API server is running on correct port
2. Check `.env.local` has correct API URL
3. Ensure CORS is configured properly
4. Check browser console for WebSocket errors

#### Database Connection Issues
**Solutions**:
1. Verify database service is running
2. Check database connection string
3. Run database migrations if needed
4. Check database permissions

## Error Messages

### Common Error Messages

#### "Failed to fetch"
**Cause**: Network or API connection issue
**Solutions**:
1. Check internet connection
2. Verify API server is running
3. Check API URL configuration
4. Clear browser cache

#### "Unauthorized"
**Cause**: Authentication token expired or invalid
**Solutions**:
1. Log out and log back in
2. Clear browser cookies
3. Check if session timeout occurred
4. Contact administrator if persists

#### "Internal Server Error"
**Cause**: Server-side issue
**Solutions**:
1. Try again in a few minutes
2. Check if issue affects all users
3. Contact technical support
4. Check server logs if you have access

## Performance Optimization

### Slow Loading Times
**Solutions**:
1. Check internet speed
2. Close unnecessary browser tabs
3. Disable browser extensions temporarily
4. Clear browser cache and data
5. Use incognito/private mode to test

### High Memory Usage
**Solutions**:
1. Restart browser
2. Close unused tabs
3. Update browser to latest version
4. Check for memory-intensive extensions

## Getting Additional Help

### When to Contact Support
- Error messages you can't resolve
- Features not working as expected
- Data loss or corruption
- Security concerns

### Information to Provide
When contacting support, include:
1. **Browser and version** (Chrome 120, Firefox 115, etc.)
2. **Operating system** (Windows 11, macOS, etc.)
3. **Steps to reproduce** the issue
4. **Error messages** (screenshots helpful)
5. **When the issue started**
6. **Your user role** (agent, client, admin)

### Emergency Contacts
- **Technical Support**: Use in-app help system
- **Account Issues**: Contact your administrator
- **Security Concerns**: Report immediately through platform

---

*Can't find your issue here? Check the specific guides for your role: [Agent Guide](../guides/agent-guide.md) | [Client Guide](../guides/client-guide.md) | [User Guide](../guides/user-guide.md)*