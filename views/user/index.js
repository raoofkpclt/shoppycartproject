//verfyPayment
const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify the payment signature
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

    if (generatedSignature === razorpay_signature) {
        try {
            // Find the order using the Razorpay order ID
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
            if (!order) {
                return res.status(404).send('Order not found');
            }

            order.status = 'paid';  
            order.razorpayPaymentId = razorpay_payment_id;  
            order.razorpaySignature = razorpay_signature;  
            order.paymentStatus = 'paid';  
            await order.save();  

            for (let item of order.items) {
                const product = await Book.findById(item.productId);
                if (product) {
                    product.stock -= item.quantity;
                    await product.save();  // Save the updated product
                }
            }

            return res.json({
                message: 'Payment verified successfully, order is now paid.',
                orderId: order._id,
                status: order.status
            });
        } catch (error) {
            console.error('Error updating order status:', error);
            return res.status(500).send('Internal server error');
        }
    } else {
        // If the payment signature does not match, return an error
        return res.status(400).send('Payment verification failed');
    }
};