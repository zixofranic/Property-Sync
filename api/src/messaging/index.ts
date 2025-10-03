// ISSUE 6 FIX: Export DTOs from messaging module for use in other modules
export * from './dto/hierarchical-unread.dto';
export {
  HierarchicalUnreadResponse,
  ClientUnreadInfo,
  PropertyUnreadInfo
} from './dto/hierarchical-unread.dto';
