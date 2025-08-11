const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Image = require('../models/Image');
const { cloudinary } = require('../config/cloudinary');
const {uploadMultiple} = require('../middleware/uploadMiddleware');   
const streamifier = require('streamifier');


const streamUpload = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'sekani' },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};


router.post('/upload', authMiddleware, uploadMultiple, async (req, res) => {
  try {
    const { category } = req.body;
    if (!category || !['Portrait', 'Event', 'Wedding'].includes(category)) {
      return res.status(400).json({ msg: 'Invalid category' });
    }

    const uploadedImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await streamUpload(file.buffer);
        uploadedImages.push(result.secure_url);
      }
    }

    const newImage = await Image.create({
      user: req.user.id,
      category,
      images: uploadedImages,
    });

    res.status(201).json({ msg: 'Images Uploaded Successfully', data: newImage });

    
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

 


// GET ALL (Public, no filters)
const optimizeCloudinaryUrl = (url) => {
  return url.replace("/upload/", "/upload/q_10,f_auto,w_1200/");
};

router.get('/all', async (req, res) => {
  try {
    const images = await Image.find().sort({ date: -1 });
    const optimized = images.map(img => ({
      ...img._doc,
      images: img.images.map(optimizeCloudinaryUrl)
    }));
    res.json(optimized);
  } catch (err) {
    console.error('Error fetching images:', err.message);
    res.status(500).send('Server Error');
  }
});







// GET admin IMAGES

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category } = req.query;

    let query = {};
    if (category) query.category = category;

    if (req.user.role !== 'admin') {
      query.user = req.user.id; // regular user sees only their images
    }

    const images = await Image.find(query).sort({ date: -1 });

    res.json(images);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).json({ msg: 'Image not found' });
        }
        res.json(image);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// UPDATE IMAGES

router.put('/:id', authMiddleware, uploadMultiple, async (req, res) => {
  try {
    const { category } = req.body;
    if (!['Portrait', 'Event', 'Wedding'].includes(category)) {
      return res.status(400).json({ msg: 'Invalid category' });
    }

    const imageDoc = await Image.findById(req.params.id);
    if (!imageDoc) {
      return res.status(404).json({ msg: 'Image not found' });
    }



 
    for (const url of imageDoc.images) {
      const publicId = url.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`sekani/${publicId}`);
    }

    
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await streamUpload(file.buffer);
        uploadedImages.push(result.secure_url);
      }
    }

    // 3. Update document
    imageDoc.category = category;
    if (uploadedImages.length > 0) {
      imageDoc.images = uploadedImages;
    }

    await imageDoc.save();

    res.json({ msg: 'Image updated successfully', image: imageDoc });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});



// delete

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ msg: 'Image not found' });
    }

   
    // if (req.user.role !== 'admin' && image.user.toString() !== req.user.id) {
    //   return res.status(401).json({ msg: 'User not authorized' });
    // }

    
    for (const url of image.images) {
      const publicId = url.split('/').pop().split('.')[0]; 
      await cloudinary.uploader.destroy(publicId);
    }

    await Image.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Image deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;