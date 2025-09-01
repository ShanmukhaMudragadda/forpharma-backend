import express from 'express';
import tenantMiddleware from '../middlewares/tenantMiddleware.js';
import { createOrder } from '../controllers/orders/createOrderController.js';
import { getOrderList } from '../controllers/orders/getOrderListController.js';
import { getOrderDetails } from '../controllers/orders/getOrderDetailsController.js';
import { updateOrder } from '../controllers/orders/updateOrderController.js';
import { deleteOrder } from '../controllers/orders/deleteOrderController.js';
import { getDrugsForOrder } from '../controllers/orders/getDrugsForOrderController.js';

const router = express.Router();

// Apply tenant middleware to all order routes
// This ensures all routes have access to req.user and req.tenantDb
router.use(tenantMiddleware);

// Order Routes
router.get('/', getOrderList);                     // GET /api/orders - List all orders
router.get('/drugs', getDrugsForOrder);            // GET /api/orders/drugs - Get drugs for order
router.get('/:orderId', getOrderDetails);          // GET /api/orders/:orderId - Get single order details
router.post('/', createOrder);                     // POST /api/orders - Create new order
router.put('/:orderId', updateOrder);              // PUT /api/orders/:orderId - Update order
router.delete('/:orderId', deleteOrder);           // DELETE /api/orders/:orderId - Delete/cancel order

export default router;
